# wwc-dashboard

The web dashboard for Wild West Cider's production system. It sits next to the
iOS cellar app (`wwc-app`) and the API (`wwc-api`), and covers:

1. **Tanks:** what's in every vessel right now.
2. **Trace:** what went into a lot and where it went, plus each lot's and
   harvest's full history, with corrections to losses and additions.
3. **Ready for sale:** finished stock.
4. **Duty:** monthly Alcohol Duty and Small Producer Relief, in the shape of the
   HMRC return, plus **Duty settings** for the reference figures.
5. **Manage:** users, vessels, orchards, and every reference list the app picks
   from (varieties, additives, suppliers & canners, packaging, loss reasons).

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
- Vitest + Testing Library

## Running locally

```sh
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api/*` to the API (default `http://localhost:8000`), so
the browser makes same-origin requests and no CORS setup is needed. Point it
elsewhere with `VITE_API_PROXY_TARGET` (see `.env.example`).

Run the API alongside it: `docker compose up` in `../wwc-api` is the simplest
(see that README). Then create a login:

```sh
cd ../wwc-api
docker compose exec api python -m wwc_api.cli create-user --email you@example.com --role admin
```

## Scripts

- `npm run dev`: dev server
- `npm run build`: typecheck + production build
- `npm run lint`: oxlint
- `npm test`: tests in watch mode (`npm run test:run` for a single run)
- `npm run preview`: serve the production build locally

## Production

Live at `https://wwc-dashboard.onrender.com`, talking to
`https://wwc-api.onrender.com`.

The app is a static SPA: `npm run build` emits `dist/`. In production it calls
the API directly via **`VITE_API_BASE_URL`**, a build-time variable Vite inlines
into the bundle. The API must in turn list this dashboard's origin in
**`CORS_ALLOW_ORIGINS`** (see the API's README).

### Deploying to Render

`render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec)
for a single static site, `wwc-dashboard`. It **auto-deploys on every push to
`main`**: it builds with `npm ci && npm run build`, publishes `dist/`, and
rewrites every path to `index.html` for client-side routing.

One-time setup: Render → **New → Blueprint** → point at this repo, then set
`VITE_API_BASE_URL` on the service to the API's URL, and set the API's
`CORS_ALLOW_ORIGINS` to this dashboard's URL. The API and dashboard deploy from
separate blueprints, so those two URLs are the only manual wiring.

**Deploy order:** when an API change needs something new from the dashboard,
deploy the dashboard first. For example, the API now rejects creates without
a client-minted id, so the dashboard had to start sending one before the API
went out.

## Writes

Anything the dashboard creates (list entries, orchards, vessels, corrections)
sends an `id` it generates itself with `crypto.randomUUID()`. The id is
created once when the form opens and reused if Save is retried after a failure,
so a retry can't create a duplicate. The API requires this.

## Roles

Three roles gate what's visible (enforced in the API too, not just here):

- **Cellar:** Tanks, Trace and Ready for sale.
- **Viewer:** the same, plus Duty, read only.
- **Admin:** everything, including Duty settings and Manage.

The "Preview role" switch at the bottom of the sidebar is a demo aid for an
admin to see a lower role's view. It is not a production feature.
