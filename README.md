# sstli_diplome-s

Arabic-first RTL SSTLI Programs Explorer built with Next.js, React, and TypeScript.

Explore diplomas and training courses with instant Arabic/English search, accessible suggestions, category and offering filters, price and duration sorting, and shareable filter URLs.

## Development

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

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
