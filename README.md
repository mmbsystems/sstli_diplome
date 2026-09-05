# sstli_diplome

Arabic-first RTL SSTLI Programs Explorer built with Next.js, React, and TypeScript.

Explore diplomas and training courses with instant Arabic/English search, accessible suggestions, category and offering filters, price and duration sorting, and shareable filter URLs.

## Development

```bash
npm ci
npm run dev
```

Open http://localhost:3000/sstli_diplome/.

## Verification

```bash
npm test
npx tsc --noEmit
npm run build
```

Stop the development server before building, since both use the `.next` directory.

## Production

```bash
npm run build
npm start
```

Program information and branch-specific offerings are maintained separately in `data/programs.ts` and `data/offerings.ts`.

## GitHub Pages

The site is published at https://mmbsystems.github.io/sstli_diplome/.
Pushes to `main` run `.github/workflows/deploy-pages.yml`: tests, static export, artifact upload, and deployment with the official GitHub Pages actions. The repository Pages source must be **GitHub Actions**.

`npm run build` writes `out/`. `npm start` serves those static files locally at `/sstli_diplome/` (set `PORT` to override 3000); it does not run a Next.js server. Do not commit `out/`.

Program routes are generated at build time. Query-driven search, filters, offering selection, and the installment calculator run in the browser. Images use the repository base path and are served without server-side optimization. No features were removed.
