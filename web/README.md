# LetsSplyt Web

Marketing landing page for [letssplyt.com](https://letssplyt.com) and [staging.letssplyt.com](https://staging.letssplyt.com).

## Development

```bash
npm run dev --workspace=@letssplyt/web
```

Opens Vite dev server at `http://localhost:5173`.

## Build

```bash
npm run build --workspace=@letssplyt/web
```

Outputs static assets to `backend/public/` (served by Express at `/`). Legal pages (`privacy.html`, `terms.html`) and `.well-known` deep-link files remain in that folder; the build also copies `legal.css` and re-wraps legal pages with the shared site chrome.

Railway builds this automatically via `nixpacks.toml`.

To update legal page styling only: edit `web/public/legal.css` and run the web build. To change legal page chrome (header/footer), edit `web/scripts/assemble-legal.mjs` and rebuild.
