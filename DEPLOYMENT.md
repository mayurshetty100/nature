# Deploying to Vercel

This app is a [TanStack Start](https://tanstack.com/start) project (SSR, built
on Vite + [Nitro](https://nitro.build)). Nitro can target many platforms from
the same codebase — these are the steps to deploy this one to Vercel.

## 1. Push the repo to GitHub (or GitLab/Bitbucket)

Vercel deploys from a Git repository. Make sure your latest changes are
committed and pushed.

## 2. Import the project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
2. Vercel will auto-detect a Node project. Use these build settings:
   - **Framework preset:** Other (or "Vite", if offered — either works since
     the build is driven by `vite build`)
   - **Build command:** `npm run build`
   - **Output directory:** leave as detected / default (Nitro's Vercel preset
     writes to `.vercel/output` automatically when it detects it's running on
     Vercel)
   - **Install command:** `npm install`

## 3. Nitro's deployment preset

Nitro auto-detects the Vercel environment (Vercel sets a `VERCEL=1` env var
during builds) and automatically builds Vercel-compatible serverless output —
no extra configuration is required for a standard deploy.

If you ever need to force the preset explicitly, you can add an environment
variable in the Vercel project settings:

| Name           | Value    |
| -------------- | -------- |
| `NITRO_PRESET` | `vercel` |

This is optional — only set it if a deploy doesn't auto-detect Vercel
correctly (for example, if you're reusing a CI pipeline that strips platform
env vars).

## 4. Environment variables

This project does **not** currently call any external API or database — there
are no required environment variables for a working deployment.

If you later add integrations (e.g. a database, auth provider, analytics,
contact-form email service), add their keys in **Vercel → Project Settings →
Environment Variables** and reference them in code via `process.env.MY_VAR`
(server-side) or `import.meta.env.VITE_MY_VAR` (client-side, must be prefixed
with `VITE_`).

## 5. Node version

Vercel uses its default Node LTS version unless you pin one. This project has
been tested with Node 18+. If you want to pin a version explicitly, add to
`package.json`:

```json
"engines": { "node": ">=18" }
```

## 6. Deploy

Click **Deploy**. Vercel will install dependencies, run `npm run build`, and
serve the SSR app (3D world route `/` plus the SSR-friendly `/portfolio`
fallback) from its edge/serverless network.

## 7. Verify after deploy

- `/` — the 3D explorable world (client-only, lazy-loaded; won't run during
  SSR but should hydrate and load in the browser).
- `/portfolio` — the plain SSR portfolio page, should render fully server-side.
- Confirm the favicon (leaf icon) and page metadata/title show up correctly in
  the browser tab and when sharing a link (Open Graph preview).

## Local production build (optional sanity check before deploying)

```sh
npm run build
npm run preview
```

This builds and serves the production bundle locally so you can catch any
build-only issues before pushing to Vercel.
