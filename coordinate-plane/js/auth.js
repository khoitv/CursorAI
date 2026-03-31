/**
 * Auth: username/password registration + Google OAuth (redirect + optional GSI popup).
 * Logged-out users see a header "Log in" button that opens a modal with two tabs:
 *   1. Password – register or sign in with username + password (stored in InstantDB)
 *   2. Google   – OAuth via Google (existing behaviour)
 * @see https://instantdb.com/docs/auth/google-oauth
 */

import { db, INSTANT_APP_ID, upsertAccountProfile } from './db.js';

const INSTANT_API = 'https://api.instantdb.com';

const GOOGLE_CLIENT_NAME =
    import.meta.env.VITE_INSTANT_GOOGLE_CLIENT_NAME || 'google-web';
const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/* ---- Custom (username + password) session helpers ---- */

const CUSTOM_SESSION_KEY = '_cp_session';

function getCustomSession() {
    try {
        const raw = localStorage.getItem(CUSTOM_SESSION_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        return (s && s.id && s.username) ? s : null;
    } catch { return null; }
}

function setCustomSession(s) {
    localStorage.setItem(CUSTOM_SESSION_KEY, JSON.stringify(s));
}

function clearCustomSession() {
    localStorage.removeItem(CUSTOM_SESSION_KEY);
}

/* ---- Password hashing (Web Crypto SHA-256) ---- */

async function sha256hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Deterministic hash: username + password + app-specific salt. */
async function hashPassword(username, password) {
    return sha256hex(`coordinate-plane:${username}:${password}`);
}

/* ---- One-shot InstantDB query helper ---- */

function dbQueryOnce(query) {
    return new Promise((resolve, reject) => {
        let done = false;
        const timer = setTimeout(() => {
            if (!done) { done = true; reject(new Error('Request timed out. Check your connection.')); }
        }, 10000);
        const unsub = db.subscribeQuery(query, (result) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            unsub();
            if (result.error) reject(result.error);
            else resolve(result.data);
        });
    });
}

/* ---- Script loader ---- */

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
    });
}

/**
 * OAuth return URL passed to Instant /oauth/start. Instant forwards to Google using the
 * **origin only** (matches Redirect Origins in Instant), so Google sees e.g.
 * `https://your-app.vercel.app` — whitelist that exact URI in Google Cloud.
 * POST to / is handled by middleware.js → /api/instant-oauth-callback → GET /?code=...
 */
function oauthAppRedirectUrl() {
    return window.location.origin;
}

function refreshRedirectLink(linkEl) {
    if (!linkEl) return;
    try {
        const redirect = encodeURIComponent(oauthAppRedirectUrl());
        const client = encodeURIComponent(GOOGLE_CLIENT_NAME);
        linkEl.href = `${INSTANT_API}/runtime/oauth/start?app_id=${INSTANT_APP_ID}&client_name=${client}&redirect_uri=${redirect}`;
    } catch (e) {
        console.error(e);
        linkEl.href = '#';
    }
}

let gsiLoadPromise = null;

/**
 * @param {Record<string, unknown> | null | undefined} user
 */
function displayNameFromUser(user) {
    if (!user) return '';
    const n = user.name || user.given_name;
    if (typeof n === 'string' && n.trim()) return n.trim();
    const e = user.email;
    if (typeof e === 'string' && e.includes('@')) {
        const local = e.split('@')[0];
        if (local) return local;
    }
    const id = user.id;
    if (typeof id === 'string' && id.length > 0) return id.length > 20 ? `${id.slice(0, 18)}…` : id;
    return 'Signed in';
}

function ensureGsiScript() {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
        return Promise.resolve();
    }
    if (!gsiLoadPromise) {
        gsiLoadPromise = loadScript('https://accounts.google.com/gsi/client');
    }
    return gsiLoadPromise;
}

/**
 * @param {{ onSignedIn: () => void }} opts
 */
export function initAuth(opts) {
    const { onSignedIn } = opts;
    const overlay = document.getElementById('auth-overlay');
    const redirectLink = document.getElementById('auth-google-redirect');
    const buttonHost = document.getElementById('auth-google-button-host');
    const modalCloseBtn = document.getElementById('auth-modal-close');
    const loginTrigger = document.getElementById('auth-login-trigger');
    const userBar = document.getElementById('auth-user-bar');
    const userTrigger = document.getElementById('auth-user-trigger');
    const userNameEl = document.getElementById('auth-user-name');
    const userDropdown = document.getElementById('auth-user-dropdown');
    const menuNameEl = document.getElementById('auth-user-menu-name');
    const menuEmailEl = document.getElementById('auth-user-menu-email');
    const signOutBtn = document.getElementById('auth-sign-out');

    // Password-form elements
    const tabPassword = document.getElementById('auth-tab-password');
    const tabGoogle = document.getElementById('auth-tab-google');
    const panelPassword = document.getElementById('auth-panel-password');
    const panelGoogle = document.getElementById('auth-panel-google');
    const modeToggle = document.getElementById('auth-mode-toggle');
    const modeLabelText = document.getElementById('auth-mode-label-text');
    const pwForm = document.getElementById('auth-pw-form');
    const displayNameInput = document.getElementById('auth-input-displayname');
    const emailInput = document.getElementById('auth-input-email');
    const usernameInput = document.getElementById('auth-input-username');
    const passwordInput = document.getElementById('auth-input-password');
    const confirmInput = document.getElementById('auth-input-confirm');
    const fieldDisplayName = document.getElementById('auth-field-displayname');
    const fieldEmail = document.getElementById('auth-field-email');
    const fieldConfirm = document.getElementById('auth-field-confirm');
    const pwError = document.getElementById('auth-pw-error');
    const pwSubmit = document.getElementById('auth-pw-submit');

    const authDisabled = import.meta.env.VITE_AUTH_DISABLED;
    if (authDisabled === 'true' || authDisabled === '1') {
        overlay?.remove();
        document.getElementById('auth-header-actions')?.remove();
        onSignedIn();
        return () => {};
    }

    let nonce = '';
    let appStarted = false;
    let isRegisterMode = false;

    /* ---- Password-form helpers ---- */

    function showPwError(msg) {
        if (pwError) { pwError.textContent = msg; pwError.hidden = false; }
    }

    function hidePwError() {
        if (pwError) { pwError.hidden = true; pwError.textContent = ''; }
    }

    function setRegisterMode(reg) {
        isRegisterMode = reg;
        if (fieldDisplayName) fieldDisplayName.hidden = !reg;
        if (fieldEmail) fieldEmail.hidden = !reg;
        if (fieldConfirm) fieldConfirm.hidden = !reg;
        if (confirmInput) confirmInput.required = reg;
        if (pwSubmit) pwSubmit.textContent = reg ? 'Create Account' : 'Sign In';
        if (modeToggle) modeToggle.textContent = reg ? 'Sign in' : 'Register';
        if (modeLabelText) modeLabelText.textContent = reg ? 'Already have an account?' : "Don't have an account?";
        if (passwordInput) passwordInput.autocomplete = reg ? 'new-password' : 'current-password';
        hidePwError();
        pwForm?.reset();
    }

    /* ---- Tab switching ---- */

    function switchTab(which) {
        const isPass = which === 'password';
        tabPassword?.classList.toggle('auth-tab--active', isPass);
        tabGoogle?.classList.toggle('auth-tab--active', !isPass);
        tabPassword?.setAttribute('aria-selected', String(isPass));
        tabGoogle?.setAttribute('aria-selected', String(!isPass));
        if (panelPassword) panelPassword.hidden = !isPass;
        if (panelGoogle) panelGoogle.hidden = isPass;
        if (!isPass) {
            refreshRedirectLink(redirectLink);
            if (GOOGLE_WEB_CLIENT_ID && buttonHost) {
                ensureGsiScript().then(() => renderGooglePopupButton()).catch(console.error);
            } else if (buttonHost) {
                buttonHost.innerHTML = '';
            }
        }
    }

    /* ---- Google popup button ---- */

    function renderGooglePopupButton() {
        if (!GOOGLE_WEB_CLIENT_ID || !buttonHost) return;
        nonce = crypto.randomUUID();
        window.google.accounts.id.initialize({
            client_id: GOOGLE_WEB_CLIENT_ID,
            callback: (response) => {
                if (!response?.credential) return;
                db.auth
                    .signInWithIdToken({
                        clientName: GOOGLE_CLIENT_NAME,
                        idToken: response.credential,
                        nonce,
                    })
                    .catch((err) => {
                        console.error(err);
                        alert(err?.body?.message || 'Google sign-in failed');
                    });
            },
            nonce,
            ux_mode: 'popup',
            use_fedcm_for_prompt: true,
        });
        buttonHost.innerHTML = '';
        window.google.accounts.id.renderButton(buttonHost, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text: 'continue_with',
            shape: 'rectangular',
        });
    }

    /* ---- Modal open/close ---- */

    function openLoginModal() {
        if (!overlay) return;
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        switchTab('password');
        setRegisterMode(false);
        usernameInput?.focus();
    }

    function closeLoginModal() {
        if (!overlay) return;
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
    }

    /* ---- Header chrome helpers ---- */

    function showLoggedOutChrome() {
        if (loginTrigger) loginTrigger.hidden = false;
        if (userBar) userBar.hidden = true;
        closeUserMenu();
        closeLoginModal();
    }

    function closeUserMenu() {
        if (!userDropdown || !userTrigger) return;
        userDropdown.hidden = true;
        userTrigger.setAttribute('aria-expanded', 'false');
    }

    function toggleUserMenu() {
        if (!userDropdown || !userTrigger) return;
        const open = userDropdown.hidden;
        userDropdown.hidden = !open;
        userTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function showUser(user) {
        if (loginTrigger) loginTrigger.hidden = true;
        if (userBar) userBar.hidden = false;
        if (userNameEl) {
            userNameEl.textContent = displayNameFromUser(user);
        }
        if (menuNameEl) {
            const legal =
                typeof user?.name === 'string' && user.name.trim()
                    ? user.name.trim()
                    : '';
            menuNameEl.textContent = legal || displayNameFromUser(user);
        }
        if (menuEmailEl) {
            const email = typeof user?.email === 'string' ? user.email : '';
            menuEmailEl.textContent = email || String(user?.id || '—');
        }
        closeUserMenu();
        closeLoginModal();
    }

    function hideUserBar() {
        closeUserMenu();
        if (userBar) userBar.hidden = true;
    }

    /* ---- Event listeners ---- */

    loginTrigger?.addEventListener('click', () => openLoginModal());

    modalCloseBtn?.addEventListener('click', () => closeLoginModal());

    overlay?.querySelector('[data-auth-backdrop]')?.addEventListener('click', () => closeLoginModal());

    userTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleUserMenu();
    });

    signOutBtn?.addEventListener('click', async () => {
        clearCustomSession();
        await db.auth.signOut();
        window.location.reload();
    });

    tabPassword?.addEventListener('click', () => switchTab('password'));
    tabGoogle?.addEventListener('click', () => switchTab('google'));

    modeToggle?.addEventListener('click', () => setRegisterMode(!isRegisterMode));

    /* ---- Password form submission ---- */

    pwForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hidePwError();

        const username = (usernameInput?.value ?? '').trim().toLowerCase();
        const password = passwordInput?.value ?? '';
        const confirm = confirmInput?.value ?? '';
        const displayName = (displayNameInput?.value ?? '').trim();
        const email = (emailInput?.value ?? '').trim().toLowerCase();

        if (!username) return showPwError('Username is required.');
        if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) {
            return showPwError('Username must be 2–32 characters: letters, numbers, _ . -');
        }
        if (password.length < 6) return showPwError('Password must be at least 6 characters.');

        if (pwSubmit) pwSubmit.disabled = true;
        try {
            if (isRegisterMode) {
                if (!email) return showPwError('Email is required.');
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showPwError('Please enter a valid email address.');
                if (password !== confirm) return showPwError('Passwords do not match.');

                const [byUsername, byEmail] = await Promise.all([
                    dbQueryOnce({ userAccounts: { $: { where: { username } } } }),
                    dbQueryOnce({ userAccounts: { $: { where: { email } } } }),
                ]);
                if (byUsername?.userAccounts?.length > 0) {
                    return showPwError('That username is already taken.');
                }
                if (byEmail?.userAccounts?.length > 0) {
                    return showPwError('An account with that email already exists.');
                }

                const hash = await hashPassword(username, password);
                const newId = crypto.randomUUID();
                await db.transact(
                    db.tx.userAccounts[newId].update({
                        username,
                        displayName: displayName || username,
                        email,
                        passwordHash: hash,
                        createdAt: Date.now(),
                    })
                );

                const session = { id: newId, username, displayName: displayName || username, email };
                setCustomSession(session);
                showUser({ name: session.displayName, id: session.id, email: session.email });
                if (!appStarted) { appStarted = true; onSignedIn(); }
                closeLoginModal();
            } else {
                const data = await dbQueryOnce({
                    userAccounts: { $: { where: { username } } },
                });
                const account = data?.userAccounts?.[0];
                if (!account) return showPwError('Username not found.');

                const hash = await hashPassword(username, password);
                if (hash !== account.passwordHash) return showPwError('Incorrect password.');

                const session = {
                    id: account.id,
                    username: account.username,
                    displayName: account.displayName || account.username,
                    email: account.email || '',
                };
                setCustomSession(session);
                showUser({ name: session.displayName, id: session.id, email: session.email });
                if (!appStarted) { appStarted = true; onSignedIn(); }
                closeLoginModal();
            }
        } catch (err) {
            showPwError(err?.message || 'Something went wrong. Please try again.');
        } finally {
            if (pwSubmit) pwSubmit.disabled = false;
        }
    });

    /* ---- Keyboard & click-outside ---- */

    function onDocPointerDown(e) {
        if (!userBar || userBar.hidden) return;
        if (userBar.contains(e.target)) return;
        closeUserMenu();
    }

    document.addEventListener('pointerdown', onDocPointerDown, true);

    function onDocumentKeydown(e) {
        if (e.key !== 'Escape') return;
        closeUserMenu();
        if (overlay && !overlay.hidden) {
            closeLoginModal();
            loginTrigger?.focus();
        }
    }

    document.addEventListener('keydown', onDocumentKeydown);

    /* ---- InstantDB auth subscription (Google OAuth path) ---- */

    const unsub = db.subscribeAuth((auth) => {
        if (auth.error) {
            console.error('Instant auth error:', auth.error.message);
        }
        if (auth.user) {
            // Signed in via Google OAuth
            upsertAccountProfile(auth.user);
            showUser(auth.user);
            if (!appStarted) {
                appStarted = true;
                onSignedIn();
            }
        } else {
            // Check for a custom (username/password) session
            const customSession = getCustomSession();
            if (customSession) {
                showUser({ name: customSession.displayName, id: customSession.id, email: '' });
                if (!appStarted) {
                    appStarted = true;
                    onSignedIn();
                }
            } else {
                hideUserBar();
                showLoggedOutChrome();
            }
        }
    });

    return () => {
        document.removeEventListener('pointerdown', onDocPointerDown, true);
        document.removeEventListener('keydown', onDocumentKeydown);
        unsub();
    };
}
