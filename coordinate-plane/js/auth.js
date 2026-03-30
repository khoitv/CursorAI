/**
 * InstantDB auth + Google OAuth (redirect + optional Google Identity Services popup).
 * Logged-out users see a header "Log in" button that opens a modal with sign-in options.
 * @see https://instantdb.com/docs/auth/google-oauth
 */

import { db, INSTANT_APP_ID, upsertAccountProfile } from './db.js';

const INSTANT_API = 'https://api.instantdb.com';

const GOOGLE_CLIENT_NAME =
    import.meta.env.VITE_INSTANT_GOOGLE_CLIENT_NAME || 'google-web';
const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

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
 * URL Instant uses for the OAuth round-trip (no hash / query).
 * For `/` we use `origin` only (no trailing slash): Instant forwards to Google as
 * `redirect_uri=https://host` — Google requires that exact string in Authorized redirect URIs.
 */
function oauthAppRedirectUrl() {
    const { origin, pathname } = window.location;
    if (!pathname || pathname === '/') {
        return origin;
    }
    return `${origin}${pathname}`;
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

    const authDisabled = import.meta.env.VITE_AUTH_DISABLED;
    if (authDisabled === 'true' || authDisabled === '1') {
        overlay?.remove();
        document.getElementById('auth-header-actions')?.remove();
        onSignedIn();
        return () => {};
    }

    let nonce = '';
    let appStarted = false;

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

    function openLoginModal() {
        if (!overlay) return;
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        refreshRedirectLink(redirectLink);
        if (GOOGLE_WEB_CLIENT_ID && buttonHost) {
            ensureGsiScript()
                .then(() => renderGooglePopupButton())
                .catch(console.error);
        } else if (buttonHost) {
            buttonHost.innerHTML = '';
        }
        modalCloseBtn?.focus();
    }

    function closeLoginModal() {
        if (!overlay) return;
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
    }

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

    loginTrigger?.addEventListener('click', () => openLoginModal());

    modalCloseBtn?.addEventListener('click', () => closeLoginModal());

    overlay?.querySelector('[data-auth-backdrop]')?.addEventListener('click', () => closeLoginModal());

    userTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleUserMenu();
    });

    signOutBtn?.addEventListener('click', async () => {
        await db.auth.signOut();
        window.location.reload();
    });

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

    const unsub = db.subscribeAuth((auth) => {
        if (auth.error) {
            console.error('Instant auth error:', auth.error.message);
        }
        if (auth.user) {
            upsertAccountProfile(auth.user);
            showUser(auth.user);
            if (!appStarted) {
                appStarted = true;
                onSignedIn();
            }
        } else {
            hideUserBar();
            showLoggedOutChrome();
        }
    });

    return () => {
        document.removeEventListener('pointerdown', onDocPointerDown, true);
        document.removeEventListener('keydown', onDocumentKeydown);
        unsub();
    };
}
