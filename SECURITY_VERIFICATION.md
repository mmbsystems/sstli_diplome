# SSTLI staff portal — final security verification

Verified locally on 2026-09-05 before committing or pushing. UI styling, program content, pricing, filters and calculators were preserved.

## Login diagnosis and fixes

- The three existing personal credentials match their bcrypt hashes and were preserved unchanged.
- The local environment had no `AUTH_SECRET`; valid credentials therefore failed during session signing. A random secret is now stored only in ignored `.env.local`.
- The live Vercel site returned the former HTTP 400 server-error response for verified Bahaa credentials. This is consistent with a missing/invalid signing secret, but its exact environment value cannot be inspected without Vercel sign-in.
- Server/configuration failures now return HTTP 500 with `تعذر تسجيل الدخول حاليًا. يرجى المحاولة لاحقًا`. Invalid credentials continue to return the generic Arabic HTTP 401 response. A safe server log code contains no credentials or stack traces.
- Same-origin checks now preserve the original Host, fixing NextURL's loopback-IP normalization mismatch. Forwarded-host spoofing remains rejected.
- Login bodies are bounded to 4096 bytes even without Content-Length, with malformed requests rejected before bcrypt comparison.
- npm lifecycle banners are suppressed so the required add-admin command does not echo password arguments. Updating an account preserves optional branch metadata.

## Accounts

15 distinct active city/branch labels were found in `data/offerings.ts`, across Riyadh, Dammam, Hafr Al Batin, Khamis Mushait, Madinah and Sakaka/Al Jouf. Each recorded label has one account; generic labels are not guessed to be aliases of numbered locations. The exact mapping is in `ADMIN_USERS.md`.

There are now 18 accounts: 3 unchanged personal accounts and 15 new branch accounts. Branch accounts have full staff access. New passwords are unique, randomly generated, 16 characters long, and contain uppercase letters, lowercase letters, numbers and symbols. Only bcrypt cost-12 hashes are stored in `config/admins.json`.

Known credentials are handed to the owner only through local `STAFF_CREDENTIALS.txt`. It was gitignored before being written. That file and `.env.local` are excluded from Git and have filesystem permissions restricted to the current Windows user. No plaintext credentials belong in this report or other tracked documentation.

## Files changed

- Removed `.github/workflows/nextjs.yml` (stale GitHub Pages deployment).
- `.gitignore`, `.npmrc`: local-secret exclusions and quiet credential-management commands.
- `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`, new `lib/auth-request.ts`: safe requests and server errors.
- `app/login/page.tsx`: inherits all root robots/Googlebot metadata.
- `config/admins.json`: 15 branch accounts with hashes only.
- `scripts/add-admin.mjs`: optional branch metadata, preserved on updates.
- `tests/auth-routes.test.ts`, `tests/add-admin.test.ts`, new `tests/branch-accounts.test.ts`: regression and account coverage checks.
- `ADMIN_USERS.md`, this report: Arabic account-management, deployment and verification instructions.

## Results before push

- `npm test`: 50 tests passed across 8 files.
- `npm run build`: passed, including type checking.
- Real production-server HTTP login, navigation, refresh, cookie flags, logout, and post-logout denial passed for all 18 accounts.
- Wrong username/password return the same Arabic error. Logged-out direct pages, APIs, data files and images redirect to `/login`; malformed cookies and unauthenticated RSC requests are denied.
- Public build assets and authenticated pages contain no account hashes. Public assets contain none of the known plaintext credentials or the signing secret.
- Root/login robots: noindex, nofollow, nocache. Googlebot: noindex, nofollow, noimageindex.
- `/robots.txt`: User-Agent: * and Disallow: /.
- Global X-Robots-Tag: noindex, nofollow, noarchive, nosnippet; verified on login, authenticated pages, redirects, auth responses, robots and static assets.
- No sitemap or marketing canonical; no index-enabling metadata. Standard Next.js/Vercel server hosting remains active.

## Vercel manual step

The dashboard requires sign-in in the available browser session. Ensure a valid random secret of at least 32 characters is configured at:

**Vercel → Project Settings → Environment Variables → AUTH_SECRET**

Use Production and any Preview environments in use, then redeploy. The value can be copied from the ignored local `.env.local` without committing it. A push to main should trigger Vercel automatically when the existing Git integration is connected. Disable any previously published GitHub Pages site separately; deleting its workflow does not unpublish it.

The existing stateless-session limitation remains: logout removes the browser cookie; a copied token may remain valid until its eight-hour expiry. Immediate per-token revocation would require a shared session store.
