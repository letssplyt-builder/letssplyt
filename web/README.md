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

Outputs static assets to `backend/public/` (served by Express at `/`). Legal pages (`privacy.html`, `terms.html`) and `.well-known` deep-link files remain in that folder and are not overwritten.

Railway builds this automatically via `nixpacks.toml`.
