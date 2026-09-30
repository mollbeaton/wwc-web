# wwc-dashboard

The web dashboard for Wild West Cider's production system. It sits next to the
iOS cellar app (`wwc-app`) and the API (`wwc-api`), and has four jobs:

1. **Tanks** — what's in every vessel right now.
2. **Traceability** — what went into a lot, and where it went.
3. **Duty** — monthly Alcohol Duty and Small Producer Relief, in the shape of the HMRC return.
4. **Management** — users, and every reference list the iOS app picks from.

Requirements are numbered WD-01 to WD-40 in the web dashboard spec.

## Principle

**The API calculates; the web app displays.** ABV, pure alcohol, duty, relief,
volume reconciliation and trace graphs are all computed by `wwc-api`. The
dashboard never does tax or volume arithmetic.

## Stack

- Vite + React + TypeScript
- React Router for routing, TanStack Query for server state
- Plain CSS with CSS-variable design tokens (`src/styles/tokens.css`), matching
  the design handoff exactly. No UI framework.
- Tabler Icons (React)

## Running locally

```sh
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api/*` to the API (default `http://localhost:8000`), so
the browser makes same-origin requests and no CORS setup is needed. Point it
elsewhere with `VITE_API_PROXY_TARGET`.

Run the API alongside it (`cd ../wwc-api && uv run uvicorn wwc_api.main:app --reload`),
and seed a user with `uv run wwc-api create-user --email you@example.com --role admin`.

## Production

The app is a static SPA. `npm run build` emits `dist/`. In production it hits the
API directly via **`VITE_API_BASE_URL`** (a build-time variable Vite inlines,
e.g. `https://wwc-api-prod.onrender.com`), and the API must list this dashboard's
origin in **`CORS_ALLOW_ORIGINS`** — see the API repo's README.

### Deploying to Render

`render.yaml` here is a [Render Blueprint](https://render.com/docs/blueprint-spec)
defining `wwc-dashboard-staging` (auto-deploys on push to `main`) and
`wwc-dashboard-prod` (manual deploy), both static sites that build with
`npm ci && npm run build` and publish `dist/`, with a catch-all rewrite to
`index.html` for client-side routing.

One-time: Render → **New → Blueprint** → point at this repo. Then set
`VITE_API_BASE_URL` on each service to the matching API URL, and set the API's
`CORS_ALLOW_ORIGINS` to this dashboard's URL. The API and dashboard deploy from
separate blueprints, so those two cross-origin URLs are the only manual wiring.

## Scripts

- `npm run dev` — dev server
- `npm run build` — typecheck + production build
- `npm run lint` — oxlint
- `npm run preview` — serve the production build locally

## Roles

Three roles gate what's visible (enforced in the API too, not just here):

- **Cellar** — Tanks and Trace.
- **Viewer** — Tanks, Trace and Duty, read only.
- **Admin** — everything, including Manage.

The "Preview role" switch at the bottom of the sidebar is a demo aid for an
admin to see a lower role's view. It is not a production feature.
