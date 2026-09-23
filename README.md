# Markd

A quiet, frontend-only markdown reader for long study notes, built as a companion to [Akada](https://github.com/nessed/akada). It uses Akada's paper tones (Paper, Warm, Stone, White, Night), its pastel palette, its type (Fraunces, Inter, IBM Plex Mono, Caveat for marginalia) and its layout: a 232px rail that collapses to icons on desktop, a bottom bar with sheets on phone, pages ruled by lines and a double fold rather than boxed into panels.

## What it does

- Notes live in the rail, each with its own pastel stripe. Search appears once there are more than three.
- Open `.md` files from the rail, drop them anywhere on the page, or paste markdown straight onto the page to make a note.
- Write with a live preview (side by side on wide screens) and one-click blocks for definitions, examples, exam tips, common mistakes, checks, steps and sources. Drafts autosave.
- Callouts: `> [!DEF]`, `[!EXAMPLE]`, `[!EXAM]`, `[!TRAP]`, `[!SOURCE]`, `[!CHECK]`, `[!STEPS]`, `[!ARGUMENT]`, plus GitHub's `NOTE`, `TIP`, `WARNING`, `IMPORTANT`.
- `[!CHECK]` blocks hide the answer until asked, then take a "Got it" or "Not yet". Results are drawn as strokes in the contents column, one per question, and kept per note.
- Contents column follows the section you're in, marks what you've passed with a highlighter swipe, and shows minutes left. Every `##` section folds, one at a time or all together.
- `==highlight==`, math via KaTeX, GFM tables and task lists, syntax-highlighted code with a copy button.
- Delete and cancel both come with undo.
- Keys: `E` edit, `N` new, `O` open a file, `/` search, `[` and `]` previous and next note, `Ctrl/⌘ S` save, `Esc` leave the editor.

## Run locally

Requires Node.js 20.9 or newer.

```bash
git clone https://github.com/nessed/Markd.git
cd Markd
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The sample document appears on first launch. Notes, reading position, check results, drafts and page settings are stored in your browser when localStorage is available.

## Deploy

Markd uses Next.js static export. No environment variables, server, database, or account are needed.

For Vercel: import `nessed/Markd`, keep the Next.js framework preset, and deploy. To host the static files elsewhere, run `npm run build` and publish the generated `out/` directory. For GitHub Pages, set an appropriate `basePath` in `next.config.ts` before building if the site will live under a repository subpath.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```
