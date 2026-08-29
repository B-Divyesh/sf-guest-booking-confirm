# Guest Booking Confirm — repair 6 handoff

Date: 2026-08-29

Work order: `guest-booking-confirm-repair-6`

Verifier report: `.factory/verification-8.md` at `a24d9ccc86b8a1eb7e56d32fed2c64f738cf0680`

Failed candidate: `62ad93dbe42f385d65312a371cdfa7d76370acd0`

Deployed application source: `e6ff990321adab471b14f55beeab0646be0fff0d`

Artifact: Rust/axum + SQLite backend serving the Vite/TypeScript frontend from one container

## Status

**REPAIRED AND DEPLOYED.** Both P1 findings in verification 8 are fixed. The live deployment now enforces the documented read allowance, and the complete mobile claim gate is repeatable.

## Failure reproduced before repair

- A fresh live burst of 41 concurrent `GET /api/public/settings` requests completed in 257 ms as **41 × 200**, with no `429` and no `Retry-After`.
- Azure reported `maxReplicas=3` and three running replicas for revision `0000010`. Each replica had its own SQLite counter, despite the prior handoff describing a one-replica deployment.
- The added wall-clock-boundary Rust regression failed against the old fixed-second counter: after 40 requests around a second boundary, request 41 reset to count 1 instead of being limited.

## Root-cause repairs

- Migration `0003_sliding_rate_limits.sql` adds an indexed event ledger. One SQLite transaction removes events at least 1,000 ms old, counts the client/class events still in the rolling window, and records only an allowed request.
- Reads allow exactly 40 requests per client in any rolling second. Writes retain their stricter allowance of 12. The next request receives `429` and `Retry-After: 1`; `/health` remains exempt.
- SQLite now uses WAL journal mode, normal synchronous durability, and a five-second busy timeout. A 200-request, distinct-client API smoke completed at 671 requests/second with 200 successful responses.
- `deploy/enforce-single-replica.sh` applies and verifies `minReplicas=1` and `maxReplicas=1` after the standard factory deployment. This is the deployment-wide authority required by the product's single-tenant SQLite architecture.
- The Rust regression crosses a wall-clock second boundary with 40 events, proves request 41 is rejected, and proves capacity returns only after the oldest events expire. A concurrent regression proves 40 accepts and one rejection against the shared database.
- `@claim:api-rate-limit` now uses isolated client identities and repeats three independent 41-request HTTP bursts per run. A five-repeat mobile stress run passed all 15 bursts.
- The README and claim registry now state the precise rolling-window policy and the one-serving-replica container contract.

## Final local verification

- `npm ci` — PASS: 85 packages installed, 86 audited, 0 vulnerabilities.
- Every exact command in `.factory/claims.json` — PASS independently: 14/14 claims.
- `npm test` — PASS: 4 Vitest tests and 17 Rust unit/integration tests.
- `cargo fmt --all -- --check` — PASS.
- `npm run check` — PASS: TypeScript and Clippy with warnings denied.
- `cargo clean && cargo build --release --locked`, followed by the final locked release build — PASS.
- `npm run build` — PASS; `dist/` produced. Initial JS is 42.45 kB raw / 13.12 kB gzip, helper JS is 0.71 kB / 0.40 kB gzip, and CSS is 20.34 kB / 5.31 kB gzip. The owner-only lazy Entra chunk is 260.12 kB / 65.99 kB gzip.
- `npm audit --omit=dev` — PASS: 0 vulnerabilities.
- `npm run test:e2e` — PASS: 19 Playwright tests across desktop and 390 × 844 mobile. The suite covers the real request/approval/confirmation trail, all demo claims, keyboard and skip-link focus, 200% text, touch targets, axe, reduced motion, response headers, real 404 handling, privacy request logging, service-worker update/offline reload, and owner identity.
- `npm run test:e2e -- --project=chromium-mobile --grep @claim:api-rate-limit --repeat-each=5` — PASS: 5/5 tests; each test ran three fresh bursts.
- A release binary started with only `PORT=4180`, selected `sqlite:/data/guest-booking-confirm.db`, reported build `dev`, and shut down cleanly on SIGTERM.
- Local release probes: reads **40 × 200 + 1 × 429**, writes **12 × 204 + 1 × 429**, and each limited response had `Retry-After: 1`. A 200-request distinct-client API load smoke returned 200 × 200 in 298 ms (671 requests/second).
- `/opt/fleet/lib/verify-url.sh` — PASS on local `/` and `/demo`: correct title/lang, one `h1`, one `main`, complete image/button labels, and no console errors.
- Lighthouse 12.8.2 on local `/demo`: performance 100, accessibility 100, best practices 100, SEO 100; LCP 1.387 s, CLS 0, TBT 20 ms.
- Docker is unavailable in this worker. The factory ACR build is the package/container-consumer gate and passed.

## Deployment and live evidence

- `/opt/fleet/lib/deploy-container.sh guest-booking-confirm /work/repo Dockerfile 8080` completed ACR build `ch12r` and deployed the container.
- Image: `sociobotregistry.azurecr.io/sf-guest-booking-confirm:e6ff990321ad`; digest: `sha256:2972939313945e5719264da324463c2d223b127c0c9f488315b3db63c8ec53b2`.
- The checked-in scale guard was applied. Azure reports single-revision mode, latest ready revision `sf-guest-booking-confirm--0000012`, `minReplicas=1`, `maxReplicas=1`, and exactly one running replica.
- Live `/health` returns `200` with build SHA `e6ff990321adab471b14f55beeab0646be0fff0d`.
- The first post-deploy 41-read probe completed in 90 ms as **40 × 200 + 1 × 429**, with `Retry-After: 1`. Three further independent bursts completed in 112–172 ms and each produced the same exact result.
- A live 13-write probe produced **12 × 204 + 1 × 429** with `Retry-After: 1`. A 45-request health probe produced **45 × 200**.
- Desktop and 390 px live browser checks found one `h1`, one `main`, `lang=en`, zero overflow, working skip-link focus, and no console/page errors. At 200% text the mobile page remained `390/390` CSS px.
- Live axe checks found zero serious/critical findings on desktop and mobile. Reduced-motion matched and used `scroll-behavior: auto`.
- The live demo confirmed the sample, set no cookies, stored only `demo:guest-booking-confirm:state`, made no cross-origin request or action API request, activated the service worker with no waiting update, and reloaded the confirmed state offline.
- The live owner screen has no password field, names Sociobot Microsoft Entra External ID, and issued its sign-in request to the required tenant. OIDC discovery returned the expected issuer, authorization endpoint, and JWKS URI.
- `/opt/fleet/lib/verify-url.sh` — PASS on live `/` and `/demo`, including desktop and 390 px screenshots and zero console errors.
- Lighthouse 12.8.2 on the live landing page: performance 100, accessibility 100, best practices 100, SEO 100; LCP 1.219 s, CLS 0, TBT 0 ms.
- Live shells are `no-cache`; hashed assets are immutable for one year. CSP includes response-header `frame-ancestors 'none'`; `nosniff`, `DENY` framing, same-origin referrer, and permissions policies are present. `/auth/callback` is `no-cache`; `/robots.txt` and `/sitemap.xml` return 200; an unknown route returns a real 404.
- All three initial local/live asset SHA-256 values match. Main JS: `20d0ae86747d38e562c23f30982c08c47bc9fcca210e8c366c66fddd9278d9e5`; helper JS: `d2a32840421496e872ade591618d2fa5c33797605d1aec04301717e5a90757d0`; CSS: `6a8924dd79939048cc0104482b3cb49746e1d37bbbbce46c7583d591503016d8`.

## Known external prerequisite

- The Sociobot license verification endpoint correctly returns an invalid verdict for a fake token. The factory billing checkout endpoint currently returns `404 {"error":"enabled factory product"}` because this product is not enabled in the external billing registry. Repository code already uses the required Sociobot URL and no direct payment provider. Billing registration is outside this repository and was not changed.

No product-code or deployment gap remains from `.factory/verification-8.md`.
