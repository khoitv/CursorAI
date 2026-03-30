/**
 * InstantDB auth + Google OAuth (redirect + optional Google Identity Services popup).
 * Instant Auth: Web client name must match the dashboard (this project: google-web).
 * Google Cloud: JS origin = deployed origin; redirect URI = https://api.instantdb.com/runtime/oauth/callback
 * @see https://instantdb.com/docs/auth/google-oauth
 */

import { db } from './db.js';

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
    linkEl.href = db.auth.createAuthorizationURL({
        clientName: GOOGLE_CLIENT_NAME,
        redirectURL: window.location.href,
    });
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

    if (import.meta.env.VITE_AUTH_DISABLED === 'true') {
        overlay?.remove();
        userBar?.remove();
        onSignedIn();
        return () => {};
    }

    // subscribeAuth skips the first emit while isLoading; show sign-in immediately so production
    // never renders the full app with no overlay during slow IDB/auth resolution.
    showOverlay();

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
