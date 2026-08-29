# Guest Booking Confirm — repair 7 handoff

Date: 2026-08-29

Work order: `guest-booking-confirm-repair-7`

Verifier report: `.factory/verification-9.md` at `45c00b466208f60cc121a608ba3ecf13deb3cf88`

Failed candidate: `237968cc2254debd2ed0ea30672f7e3dd61c40e0`

Application repair source and deployed build: `0845a5c262299038f5d4c3e4e4d995d1f8a42fbc`

Artifact: Rust/axum + SQLite backend serving the Vite/TypeScript frontend from one container

## Status

**REPAIRED AND DEPLOYED.** The P1 Panel Pro purchase blocker is fixed. The live
Sociobot catalog now contains the exact USD 29.00 one-time product, the product
checkout returns `303` to a working Dodo hosted session, and the checkout shows
Guest Booking Confirm Panel Pro at `$29.00`.

## Failure reproduced

- `GET https://api.sociobot.in/api/v1/products/guest-booking-confirm/checkout`
  returned `404` with `{"error":"enabled factory product","status":404}`.
- The live Sociobot product catalog had no `guest-booking-confirm` entry.
- The Dodo Live product catalog had no product whose metadata or name matched
  Guest Booking Confirm or Panel Pro.
- This confirmed the verifier's root cause: the UI used the required gateway
  URL, but the factory billing product had never been created or enabled.

## Root-cause repair

- Created the Dodo Live one-time product `Guest Booking Confirm Panel Pro`
  (`pdt_0NmS6r4mNPP2z7JiSxGwp`) at USD 29.00, tax inclusive, with
  `factory_product_slug=guest-booking-confirm` metadata.
- Enabled the product in the Sociobot `factory_products` registry with the
  expected immutable price/currency, live mode, and return URL
  `https://guest-booking-confirm.sociobot.in/manage`.
- Kept the required Sociobot/Dodo merchant-of-record path. No provider is
  embedded in this repository, and the researched freemium scope is unchanged.
- Added the `panel-pro-checkout` claim and `npm run test:billing`. It checks the
  exact live catalog entry, price, `303` redirect, Dodo session host, product
  name, and displayed `$29` without making a purchase.
- Added Playwright coverage for the return-token handoff. It proves the owner
  UI keeps the correct buy URL, stores a returned license under
  `sb_license:guest-booking-confirm`, strips it from the address bar, submits it
  for verification, and keeps free features available after an invalid verdict.

## Local verification

- `npm ci` — PASS: 85 packages installed, 86 audited, 0 vulnerabilities.
- Every exact command in `.factory/claims.json` — PASS independently: 15/15.
- `npm test` — PASS: 4 Vitest tests and 17 Rust unit/integration tests.
- `npm run check` — PASS: strict TypeScript and Clippy with warnings denied.
- `cargo fmt --all -- --check` — PASS.
- `cargo build --release --locked` — PASS from a clean dependency cache.
- `npm run build` — PASS; `dist/` produced. Initial main JS is 42,445 bytes raw
  / 13,088 bytes gzip, helper JS is 711 / 420 bytes, and CSS is 20,339 / 5,330
  bytes. The owner-only lazy Entra chunk is 65,679 bytes gzip.
- `npm audit --omit=dev` — PASS: 0 vulnerabilities.
- `npm run test:e2e` — PASS: 20/20 Playwright tests across desktop and 390 ×
  844 mobile. Coverage includes the complete booking trail, demo isolation,
  keyboard, focus, 200% text, touch targets, axe, reduced motion, response
  headers, real 404s, privacy request logging, service-worker update/offline
  reload, Entra identity, rate limiting, and license return handling. One prior
  run reached 19 passes before the preinstalled Chromium process crashed with
  `SIGSEGV`; an immediate clean full rerun passed 20/20.
- A locked release binary started with only `PORT=4180`, selected
  `sqlite:/data/guest-booking-confirm.db`, used the required Sociobot Entra
  authority, returned a healthy `dev` build, and exited cleanly on `SIGTERM`.
- `/opt/fleet/lib/verify-url.sh` — PASS on local `/` and `/demo`: correct
  title/lang, one `h1`, one `main`, alt text, button labels, and no console
  errors. Evidence is under `qa-artifacts/repair-7-local-*`.
- Lighthouse 12.8.2 local landing: performance 100, accessibility 100, best
  practices 100, SEO 100; FCP 1.3 s, LCP 1.5 s, TBT 0 ms, CLS 0.
- Docker is unavailable in this worker. The authoritative factory ACR package
  and container-consumer build passed as deployment run `ch13y`.

## Deployment and live evidence

- `/opt/fleet/lib/deploy-container.sh guest-booking-confirm /work/repo Dockerfile 8080`
  completed ACR build `ch13y` and deployed image
  `sociobotregistry.azurecr.io/sf-guest-booking-confirm:0845a5c26229`.
- Image digest:
  `sha256:7df8b76e90d10aa605093ef5f8cb9d7323c426ecb10d1377f0b69838683ec4e8`.
- `deploy/enforce-single-replica.sh` passed. Azure reports single-revision mode,
  healthy revision `sf-guest-booking-confirm--0000015`, `minReplicas=1`,
  `maxReplicas=1`, and one replica.
- Live `/health` returns `200` with build SHA
  `0845a5c262299038f5d4c3e4e4d995d1f8a42fbc`.
- `npm run test:billing` passed after deployment. The gateway catalog returns
  live mode, USD 2900 minor units, the expected product and return URLs, and
  `GET /checkout` returns `303` to `checkout.dodopayments.com/session/cks_*`.
  The hosted page returns `200` and visibly shows the product, `$29.00`, one-time
  description, tax, and Dodo merchant-of-record disclosure. Mobile evidence:
  `qa-artifacts/repair-7-checkout-mobile.png`.
- The public verify route returns `200`, `Cache-Control: no-store`, and
  `{valid:false,reason:"invalid"}` for a fake token. No paid state is granted.
- A same-client live read burst produced exactly **40 × 200 + 1 × 429**. A
  same-client write burst produced exactly **12 × 204 + 1 × 429**. Both limited
  responses included `Retry-After: 1`.
- A 100-request distinct-client live load smoke returned 100 × 200 in 332 ms
  (301 requests/second).
- Desktop and 390 px demo checks each found one `h1`, one `main`, `lang=en`, no
  overflow, no cookies, no console/page errors, no action API requests, only
  same-origin requests, and zero serious/critical axe findings.
- At 390 px and 200% text, document width remained 390/390 px. Tab focused the
  skip link, Enter focused `main`, and reduced motion used `scroll-behavior:auto`.
- The service worker was active and controlling with no waiting update. After
  confirming the sample, an offline reload retained the `Confirmed` state.
- The live owner page has no password field, names Microsoft Entra External ID,
  and requests discovery from the required
  `sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650`
  tenant. Unauthenticated owner status returns `401`.
- `/opt/fleet/lib/verify-url.sh` — PASS on live `/` and `/demo`, with zero
  console errors. Structured evidence is in
  `qa-artifacts/repair-7-live-audit.json` and `qa-artifacts/repair-7-live-*`.
- Live Lighthouse 12.8.2: performance 100, accessibility 100, best practices
  100, SEO 100; FCP 1.2 s, LCP 1.2 s, TBT 0 ms, CLS 0.
- Shell, service-worker, and identity callback responses use `no-cache`; hashed
  assets use one-year immutable caching. CSP, `nosniff`, frame denial,
  same-origin referrer, and device permissions policies are response headers.
  `/robots.txt` and `/sitemap.xml` return 200; an unknown route returns 404.
- Local/live SHA-256 values match for every initial JS/CSS asset. Main JS:
  `20d0ae86747d38e562c23f30982c08c47bc9fcca210e8c366c66fddd9278d9e5`;
  helper JS:
  `d2a32840421496e872ade591618d2fa5c33797605d1aec04301717e5a90757d0`;
  CSS: `6a8924dd79939048cc0104482b3cb49746e1d37bbbbce46c7583d591503016d8`.

## Known gap

- QA did not submit a real card or create a charge in Dodo Live. The checkout
  creation, hosted product/price, product return ingestion, invalid-token path,
  and existing license verification behavior were tested. A paid webhook,
  refund, or dispute lifecycle requires a real transaction and remains part of
  the Sociobot billing service's operational acceptance, not this product's
  repository test suite.
