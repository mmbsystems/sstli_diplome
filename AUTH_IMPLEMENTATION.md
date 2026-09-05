# Staff authentication implementation

## Added files

- `.env.example`, `.npmrc`
- `config/admins.json` (empty; no default account)
- `lib/auth.ts`, `lib/session.ts`, `middleware.ts`
- `app/login/page.tsx`, `app/login/LoginForm.tsx`
- `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`
- `app/(staff)/layout.tsx`, `app/robots.ts`
- `scripts/add-admin.mjs`, `scripts/server-only-json.cjs`
- `tests/auth.test.ts`, `tests/auth-routes.test.ts`, `tests/add-admin.test.ts`
- `.github/workflows/ci.yml`, `ADMIN_USERS.md`, this report

## Changed or moved files

- Moved the home page and both program routes under `app/(staff)` without changing their URLs; added server authorization before delivering program data and metadata.
- `app/layout.tsx`: global noindex metadata; staff header/footer live inside the authenticated layout.
- `app/globals.css`: login and staff action styles.
- `components/programs/ProgramExplorer.tsx`: receives data from the authenticated server instead of bundling it into public JavaScript.
- `components/program-details/ProgramDetails.tsx`: restores initial city/mode selection from the URL, covered by the existing regression test.
- `lib/site.ts`, `next.config.ts`: standard server hosting, global robots headers, and a build guard against direct client imports of account JSON.
- `package.json`, `package-lock.json`: bcryptjs, jose, server-only, admin command, Next.js start command, and a patched PostCSS override.
- `tests/explorer.test.tsx`: supplies the explorer's new data props.
- `README.md`: development and Vercel instructions.
- Removed `.github/workflows/deploy-pages.yml` and `scripts/serve-export.mjs`.

## Authentication and sessions

Passwords use bcryptjs with cost 12. Credential verification runs on the server and returns generic Arabic failures. Account data is guarded by `server-only`; direct JSON client imports are also rejected by the build. Middleware protects non-public requests, with additional server checks before rendering staff pages and program metadata. Authentication POST requests require a matching Origin.

HS256-signed sessions expire after eight hours. Cookie: `sstli_session`, with `httpOnly`, `sameSite=lax`, `path=/`, and `secure` in production. No localStorage or public secret is used. Missing secrets and malformed/expired cookies fail closed.

Logout deletes the browser cookie. This is a stateless session design: a previously copied token remains usable until expiry. Rotate `AUTH_SECRET` to invalidate all signed sessions. Immediate revocation of individual copied tokens would require a shared persistent session/revocation store.

## Manual setup

Follow `ADMIN_USERS.md` to create the first account locally and deploy its hash. Set a random `AUTH_SECRET` of at least 32 characters in Vercel **Project Settings → Environment Variables**, then redeploy. Keep Next.js default output settings, remove any `out` override, and disable any previously published GitHub Pages site. Configure login request rate limiting in Vercel Firewall.

No account, real password, or real signing secret was added. Nothing was committed, pushed, or deployed during implementation.

## Verification

Automated tests cover signed and expired sessions, malformed cookies, incorrect credentials, successful login, navigation/refresh with a session, logout and subsequent denial, cross-origin requests, admin creation/update, and existing program functionality. Temporary accounts are isolated test fixtures; `config/admins.json` remains `[]`.

Production HTTP checks verified redirects for `/`, `/programs`, a detail URL, and account-file access; malformed-cookie denial; `/robots.txt`; login metadata; and the exact global `X-Robots-Tag`. Public build assets were checked for account fields, signing-secret references, and catalog text. The Arabic login layout and generic error were also checked in the browser at mobile width.

Robots blocking uses root/login metadata, `User-agent: * / Disallow: /`, and `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`. Existing search results may still require removal through Search Console.

Final results: 46 tests passed across 7 files; npm run build completed successfully; npm audit --omit=dev reported zero vulnerabilities; git diff --check passed.
