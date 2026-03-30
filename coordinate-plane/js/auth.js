/**
 * InstantDB auth + Google OAuth (redirect + optional Google Identity Services popup).
 * Instant Auth: Web client name must match the dashboard (this project: google-web).
 * Google Cloud: JS origin = deployed origin; redirect URI = https://api.instantdb.com/runtime/oauth/callback
 * @see https://instantdb.com/docs/auth/google-oauth
 */

import { db, INSTANT_APP_ID } from './db.js';

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

function refreshRedirectLink(linkEl) {
    if (!linkEl) return;
    try {
        // Instant's helper omits encoding; query params in the page URL would break the start URL.
        const redirect = encodeURIComponent(window.location.href);
        const client = encodeURIComponent(GOOGLE_CLIENT_NAME);
        linkEl.href = `${INSTANT_API}/runtime/oauth/start?app_id=${INSTANT_APP_ID}&client_name=${client}&redirect_uri=${redirect}`;
    } catch (e) {
        console.error(e);
        linkEl.href = '#';
    }
}

let gsiLoadPromise = null;
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
    const userBar = document.getElementById('auth-user-bar');
    const userEmail = document.getElementById('auth-user-email');
    const signOutBtn = document.getElementById('auth-sign-out');

    const authDisabled = import.meta.env.VITE_AUTH_DISABLED;
    if (authDisabled === 'true' || authDisabled === '1') {
        overlay?.remove();
        userBar?.remove();
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

    function showOverlay() {
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
    }

    function hideOverlay() {
        if (!overlay) return;
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
    }

    function showUser(user) {
        if (userBar) userBar.hidden = false;
        if (userEmail) {
            userEmail.textContent = user.email || user.id || 'Signed in';
        }
    }

    function hideUserBar() {
        if (userBar) userBar.hidden = true;
    }

    signOutBtn?.addEventListener('click', async () => {
        await db.auth.signOut();
        window.location.reload();
    });

    // subscribeAuth skips the first emit while isLoading; show sign-in until we know there is a session.
    showOverlay();

    const unsub = db.subscribeAuth((auth) => {
        if (auth.error) {
            console.error('Instant auth error:', auth.error.message);
        }
        if (auth.user) {
            hideOverlay();
            showUser(auth.user);
            if (!appStarted) {
                appStarted = true;
                onSignedIn();
            }
        } else {
            hideUserBar();
            showOverlay();
        }
    });

    return unsub;
}
