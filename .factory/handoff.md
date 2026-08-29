# Guest Booking Confirm — repair 5 handoff

Date: 2026-08-29

Work order: `guest-booking-confirm-repair-5`

Verifier report: `.factory/verification-7.md` at `3a9843443cffbb4c277f2f3f47d9e2a7aa3ba1c5`

Failed candidate: `7aa1a7ebefabfb0adf485103487367676f916c6b`

Artifact: Rust/axum + SQLite backend serving the Vite/TypeScript frontend from one container

## Status

**DEPLOYED.** All verifier findings are repaired with regression coverage. Clean local gates and production checks pass. The live container reports repair source `18ee7792d9dbc6f21a668aded8da00499156eee5`.

## Repairs

- Free capacity is now enforced by one SQLite `INSERT … SELECT … WHERE` statement. The registered claim seeds 29 active bookings, sends 12 concurrent valid requests, proves exactly one creation and 11 limit conflicts, and asserts a final count of 30.
- Owner authentication now uses the Sociobot Microsoft Entra External ID tenant at `sociobotcustomers.ciamlogin.com`. The frontend uses MSAL with Authorization Code + PKCE. The backend discovers OIDC metadata/JWKS and validates RS256, issuer, audience, tenant, expiry/nbf, and owner `oid`. Local Argon2 passwords, password sessions, and `/api/owner/login` were removed. A schema migration removes their stored columns/table and adds the Entra owner ID; an upgrade regression covers the old schema.
- The 390 px hours editor now gives every opening and closing input `147.328125 × 44` CSS px and preserves every `HH:MM` value. The regression checks all 14 inputs at 390 × 844.
- Rate counts moved from process memory to an atomic SQLite upsert keyed by the first `X-Forwarded-For` hop and read/write class. The intended factory deployment is pinned to one replica because this is a single-tenant SQLite service. Local HTTP evidence is 40 × 200 then 1 × 429 for reads, 12 × 204 then 1 × 429 for writes, both with `Retry-After: 1`; 45 health checks remain 200.
- Removed the untested “unguessable” wording. Added exact Entra and container contract claims. The reminder claim now records requests starting immediately before the action, proves zero action requests, reloads, and proves only same-origin GET requests plus persisted demo state.
- The cold-screen action note now has an 8 px gap instead of a −14 px overlap. Its regression measures the action and note rectangles.
- At 200% root text on a 390 px viewport, the cold page remains exactly `scrollWidth = clientWidth = 390`.
- Name, business, and service length validation now counts Unicode scalar characters. Regressions reject one-character `李`, accept two-character `李小`, and reject 81 multibyte characters.
- Auth callbacks are `no-cache`, excluded from service-worker storage, and allowed by the Entra-aware CSP. The service worker update regression inspects Cache Storage before exercising offline demo reload.
- The skip link now moves keyboard focus to `<main>`. Desktop coverage checks this, reduced motion, landing/demo axe results, and the Entra owner entry screen.

## Regression and verification evidence

- `npm ci` — PASS: 85 packages installed; 86 audited; 0 vulnerabilities.
- Every exact command in `.factory/claims.json` — PASS independently: 14/14 claims.
- `npm test` — PASS: 4 Vitest tests and 16 Rust unit/integration tests.
- `cargo fmt --all -- --check` — PASS.
- `npm run check` — PASS: TypeScript and Clippy with warnings denied.
- `npm run build` — PASS; `dist/` produced. Initial app JS is 42.45 kB raw / 13.12 kB gzip, CSS is 20.34 kB raw / 5.31 kB gzip, and the owner-only lazy Entra chunk is 260.12 kB raw / 65.99 kB gzip.
- `cargo build --release --locked` — PASS from a clean Cargo target.
- Release binary with only `PORT=4183` — PASS: selected `sqlite:/data/guest-booking-confirm.db`, logged the default Entra authority without a secret, returned `{"build_sha":"dev","status":"ok"}`, and exited cleanly on SIGTERM.
- `npm run test:e2e` — PASS: 19 Playwright tests across Chromium at 390 × 844 and 1440 × 900. Coverage includes real request/approval/confirmation, every demo claim, keyboard, skip link, reduced motion, exact touch targets, 200% text reflow, response headers, offline/update behavior, privacy request logs, and axe serious/critical checks.
- `/opt/fleet/lib/verify-url.sh` on local `/` and `/demo` — PASS: title, `lang=en`, one `h1`, `<main>`, alt labels, and zero console/page errors at desktop and 390 px.
- Lighthouse 12.8.2 on local production `/demo` — performance 100, accessibility 100, best practices 100, SEO 100; LCP 1.335 s, CLS 0, total blocking time 66 ms.
- Live identity preflight — PASS: OIDC discovery returned the expected issuer, authorization endpoint, and JWKS URI. The production `/auth/callback` authorize request returned the provider sign-in page without `AADSTS50011` redirect mismatch.
- Docker is unavailable in the worker image. ACR run `ch11c` completed the multi-stage Docker build and pushed digest `sha256:7009c619d4591b516423e2177b06b5b10d9cdad1a5bee484f9a6d1e2df0a74c4`; this is the package/container-consumer gate.

## Live verification

- `/health` returns `{"build_sha":"18ee7792d9dbc6f21a668aded8da00499156eee5","status":"ok"}`.
- The deployed revision is `sf-guest-booking-confirm--0000009`, image `sociobotregistry.azurecr.io/sf-guest-booking-confirm:18ee7792d9db`, with `minReplicas=1` and `maxReplicas=1`.
- Live rate checks match policy: 41 concurrent reads produced 40 × 200 and 1 × 429; 13 concurrent writes produced 12 × 204 and 1 × 429. Both limited responses had `Retry-After: 1`; 45 concurrent health checks produced 45 × 200.
- Live 390 px Chromium measured an 8 px action/note gap, normal and 200% widths of `390/390`, no owner-password field, the Entra notice, and a real request to the required tenant discovery URL after activating **Sign in with Sociobot**.
- The live demo reached **Confirmed**, set no cookie, wrote only `demo:guest-booking-confirm:state`, made no cross-origin request, and reloaded as **Confirmed** while offline.
- Live axe found zero serious/critical issues. `verify-url.sh` passed `/` and `/demo` at desktop and 390 px with zero console/page errors.
- Live response checks passed for CSP, `nosniff`, framing denial, referrer/permissions policies, shell `no-cache`, immutable hashed assets, real 404, `robots.txt`, and `sitemap.xml`.
- Live and local main JS SHA-256 both equal `20d0ae86747d38e562c23f30982c08c47bc9fcca210e8c366c66fddd9278d9e5`; live and local CSS both equal `6a8924dd79939048cc0104482b3cb49746e1d37bbbbce46c7583d591503016d8`.
- Lighthouse 12.8.2 on the live landing page: performance 100, accessibility 100, best practices 100, SEO 100; LCP 1.218 s, CLS 0, total blocking time 0 ms.

## Deployment

Deployed repair source `18ee7792d9dbc6f21a668aded8da00499156eee5` to Azure Container App `sf-guest-booking-confirm` in resource group `sociobot`. ACR `sociobotregistry` built the source tar with `.git` excluded. Revision `0000009` serves <https://guest-booking-confirm.sociobot.in> at 100% traffic with one replica.

## Known gaps

- No end-user credentials were used. The public provider discovery, registered production callback, real browser redirect request, backend token-validation code, and isolated identity regressions were verified without impersonating a user.
- No product gap remains from `.factory/verification-7.md`.
