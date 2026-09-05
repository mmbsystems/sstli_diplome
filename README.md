# SSTLI staff programs explorer

Private Arabic RTL Next.js application. Search, filters, program details, branch offerings and installment calculations are preserved behind staff authentication.

See [ADMIN_USERS.md](ADMIN_USERS.md) for account creation and Vercel setup. No initial account is supplied.

## Development

Run `npm ci`. Copy `.env.example` to `.env.local`, set a random `AUTH_SECRET`, create a staff account, then run `npm run dev`. Open http://localhost:3000/login.

## Verification and production

```bash
npm test
npm run build
npm start
```

Deploy with Vercel's standard Next.js preset. This application requires a server and cannot be deployed as static files. CI tests and builds; Vercel handles deployment. Disable any previously published GitHub Pages site separately.

Program content remains in `data/programs.ts` and `data/offerings.ts`. The authenticated server passes it to the existing interactive explorer. Account data is consumed only by server-only authentication utilities.
