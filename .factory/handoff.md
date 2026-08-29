# Guest Booking Confirm — repair 5 handoff

Date: 2026-08-29

Work order: `guest-booking-confirm-repair-5`

Verifier report: `.factory/verification-7.md` at `3a9843443cffbb4c277f2f3f47d9e2a7aa3ba1c5`

Failed candidate: `7aa1a7ebefabfb0adf485103487367676f916c6b`

Artifact: Rust/axum + SQLite backend serving the Vite/TypeScript frontend from one container

## Status

All verifier findings are repaired with regression coverage. Clean local quality gates pass. The source commit and production rollout evidence are recorded below after deployment.

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
- Docker is unavailable in the worker image. The Azure Container Registry remote build is the package/container-consumer gate and is recorded after rollout.

## Deployment

Pending in this source commit. Target: Azure Container App `sf-guest-booking-confirm` in resource group `sociobot`, built by ACR `sociobotregistry`, custom domain <https://guest-booking-confirm.sociobot.in>, min/max replicas `1/1`.

## Known gaps

- No end-user credentials were used. The public provider discovery, registered production callback, real browser redirect request, backend token-validation code, and isolated identity regressions were verified without impersonating a user.
- No product gap remains from `.factory/verification-7.md`.
