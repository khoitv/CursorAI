# Technology Office Room — Floor Plan

Interactive office floor plan in the browser: pan, zoom, optional grid, labels, and dimensions; edit layout; export to JSON, XML, PNG, or JPEG; import JSON or XML. Sign-in uses [Instant](https://www.instantdb.com/) with Google OAuth when configured.

The app lives in [`coordinate-plane/`](coordinate-plane/).
Demo Url: [`coordinate-plane/`](https://coordinate-plane-two.vercel.app/).
## Requirements

- Node.js 18+ (recommended)

## Local development

```bash
cd coordinate-plane
npm install
```

Copy [coordinate-plane/.env.example](coordinate-plane/.env.example) to `coordinate-plane/.env.local` and set variables as needed (see comments in the example file).

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

To exercise Google OAuth locally, use Vercel’s dev proxy so the OAuth callback matches production behavior:

```bash
npx vercel dev
```

Optional for local-only work: set `VITE_AUTH_DISABLED=true` in `.env.local` to skip sign-in. Do **not** enable that in production.

## Build

```bash
cd coordinate-plane
npm run build
```

Static output is written to `coordinate-plane/dist`. Preview with `npm run preview`.

## Deploy (Vercel)

The project is set up for Vercel (`coordinate-plane/vercel.json`: Vite build, `dist` output). Add the same environment variables you use locally in the Vercel project settings, then redeploy.

Google OAuth: the authorized redirect URI must include your site origin. Instant posts the OAuth response to `/`; Edge middleware forwards `POST /` to `/api/instant-oauth-callback` so the callback works on Vercel.

## Stack

- [Vite](https://vitejs.dev/) — dev server and build
- Vanilla JavaScript + SVG
- [@instantdb/core](https://github.com/instantdb/instant) — auth/sync when configured
- [@vercel/edge](https://vercel.com/docs/functions/edge-middleware) — middleware for OAuth `POST /`
