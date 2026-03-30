/**
 * InstantDB sends Google redirect_uri = site origin only (not /api/...).
 * Google POSTs the OAuth response to /. Static files return 405 for POST.
 * Forward POST / → /api/instant-oauth-callback (same handler as before).
 */
import { next } from '@vercel/edge';

export default async function middleware(request) {
    const url = new URL(request.url);
    const path = url.pathname === '' ? '/' : url.pathname;
    if (path !== '/' || request.method !== 'POST') {
        return next();
    }

    const body = await request.arrayBuffer();
    const headers = new Headers(request.headers);
    headers.delete('content-length');

    return fetch(new URL('/api/instant-oauth-callback', url.origin), {
        method: 'POST',
        headers,
        body,
    });
}

export const config = {
    matcher: '/',
};
