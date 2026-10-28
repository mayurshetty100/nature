# Mayur's World — An Explorable 3D Portfolio

An interactive, explorable 3D portfolio island built with React Three Fiber and
TanStack Start. Walk, drive, or fly around the island to discover each chapter
of Mayur Shetty's journey, or visit `/portfolio` for a classic, text-based
fallback that works without WebGL.

## Built with

- TanStack Start (React 19, file-based routing, SSR)
- React Three Fiber / drei / three.js
- Tailwind CSS
- Zustand
- TypeScript

## Development

You'll need Node.js (18+) installed.

```sh
npm install
npm run dev
```

The app runs at `http://localhost:3000` (or the next available port — check
the terminal output).

Other useful scripts:

```sh
npm run build      # production build
npm run preview    # preview the production build locally
npm run lint        # eslint
npm run test        # vitest
```

## Project structure

See `AGENTS.md` for a detailed map of the architecture (world rendering,
game logic, data sources, etc.) — it's kept up to date as the project grows.

## Deployment

See `DEPLOYMENT.md` for step-by-step instructions on deploying this app to
Vercel.
