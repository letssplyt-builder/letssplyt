# LetsSplyt Web Landing

Marketing site built with Vite. Output is copied to `backend/public/` for Railway to serve at the app root.

## Dev

```bash
npm run dev --workspace=@letssplyt/web
```

Opens Vite dev server at `http://localhost:5173`.

## Narrative approach

Condensed single-scroll story (4 sections):

1. **Hero** — promise + Mark quote + audience pills
2. **Problem** — side-by-side chat moment + before/after contrast strip
3. **How** — 3-beat timeline (join → split → done)
4. **CTA** — download + trust pills + footer

Copy stays research-backed; layout removes duplicate intros, stats, persona cards, and a separate trust section.

## Build

```bash
npm run build:web
```

Legal pages (`privacy.html`, `terms.html`) are assembled into `backend/public/` by `scripts/assemble-legal.mjs`.
