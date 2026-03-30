/**
 * Google OAuth returns with response_mode=form_post (POST + form body).
 * Static hosting cannot handle POST. We accept POST here, then redirect GET to /
 * with query params so @instantdb/core can read code + _instant_oauth_redirect.
 */
function parseFormBody(req) {
    const raw = req.body;
    if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw) && !Array.isArray(raw)) {
        return raw;
    }
    if (Buffer.isBuffer(raw)) {
        return Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
    }
    if (typeof raw === 'string') {
        return Object.fromEntries(new URLSearchParams(raw));
    }
    return {};
}

export default function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    const body = parseFormBody(req);
    const params = new URLSearchParams();
    params.set('_instant_oauth_redirect', '1');

    for (const [key, value] of Object.entries(body)) {
        if (key === '_instant_oauth_redirect') continue;
        if (value == null || value === '') continue;
        params.set(key, String(value));
    }

    const qs = params.toString();
    const location = `/?${qs}`;
    return res.writeHead(302, { Location: location }).end();
}
