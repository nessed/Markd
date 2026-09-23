# Markd

A quiet, frontend-only markdown reader for long study notes. Its paper and night palettes, Fraunces/Inter/IBM Plex Mono typography, spacing, and soft accent colours are drawn from [Akada](https://github.com/nessed/akada).

## Run locally

Requires Node.js 20.9 or newer.

```bash
git clone https://github.com/nessed/Markd.git
cd Markd
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The sample document appears on first launch. Notes, reading position, text size, and an explicit theme choice are stored in your browser when localStorage is available.

## Deploy

Markd uses Next.js static export. No environment variables, server, database, or account are needed.

For Vercel: import `nessed/Markd`, keep the Next.js framework preset, and deploy. To host the static files elsewhere, run `npm run build` and publish the generated `out/` directory. For GitHub Pages, set an appropriate `basePath` in `next.config.ts` before building if the site will live under a repository subpath.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```
