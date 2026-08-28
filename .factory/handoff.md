# Guest Booking Confirm — independent verification 4: **FAIL**

Date: 2026-08-28
Verified candidate: `04da75a04ebe6815e8816b01c8f9fca16d32f3ea`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Verification outcome

**FAIL — release blocked.** Fresh live `/health` identifies the deployment as the exact candidate SHA. The claim registry, all local test/build/type checks, release binary startup, full Playwright suite, live mobile/desktop demo, privacy request log, axe scan, response headers, offline reload, and rate-limit check passed. The complete evidence is in `.factory/verification-4.md`.

### P1 release-blocking defect

`Dockerfile:8` pins `FROM rust:1.88-bookworm AS backend`. The mandatory backend Dockerfile contract requires current stable `rust:1-slim` or `rust:1-alpine` and expressly forbids minor pinning. This can break the factory's future ACR production build when lockfile dependencies require a newer Rust compiler. Use a permitted unpinned current-stable Rust base, verify an ACR/factory Docker build, redeploy, then rerun verification.

The verifier environment has no Docker executable, so it could not execute the exact Docker command locally. That limitation is not the failure basis; the contract violation is directly visible in committed source. No product code was modified by this verification.

---

# Guest Booking Confirm — repair handoff: **READY FOR DEPLOYMENT**

Date: 2026-08-28
Work order: `guest-booking-confirm-repair-2`
Verifier report repaired: `.factory/verification-3.md` against candidate `935265f70b2055860153c03b17f08bc04ec9c27f`

## Fixed release blockers

- Guest confirmation now uses a conditional SQLite update. Concurrent uses of one private link yield exactly one `200` and one `409`; the row ends `confirmed`.
- Guest cancellation and rescheduling also compare the state read from the private link when writing, so parallel use cannot silently overwrite a just-completed guest action.
- Owner approval is now a single conditional update that checks for an existing accepted booking inside the write. Parallel owner approvals for the same slot leave exactly one held booking.
- Setup and settings now reject malformed, out-of-range, inverted, and too-short weekly intervals with `422`. The owner form performs the same check before it sends, with the direct recovery message “Monday closing time must be later than opening time.”
- Completed the claims registry for no-account guests, owner approval, free and paid capacity/retention, and rate limiting, with exact runnable regression commands.
- Corrected the paid-plan mobile contrast failure and expanded practical navigation, owner-action, and footer tap targets to 44px.

## Exact verification evidence

Clean install: `npm ci` completed with 0 vulnerabilities.

- `npm test` — PASS: 4 Vitest and 9 Rust tests.
- `npm run check` — PASS: strict TypeScript and `cargo clippy -- -D warnings`.
- `npm run build` — PASS: `dist/`; initial main JS 36.99 kB raw / 11.61 kB gzip, CSS 19.85 kB raw / 5.23 kB gzip.
- `npm run test:e2e` — PASS: 10 Playwright checks, including desktop routing and 390px mobile guest workflow, invalid-hours recovery, demo/offline, privacy, claims, and axe serious/critical scan.
- `cargo build --release --locked` — PASS.
- `npm audit --omit=dev` — PASS: 0 vulnerabilities.
- Every command recorded in `.factory/claims.json` was run from a clean Playwright/Rust test server and passed.

Runtime evidence on a fresh SQLite desk at `http://127.0.0.1:4180` is retained in `.factory/qa-artifacts/`:

- `backend-concurrency.json`: one accepted booking for 12 simultaneous owner approvals; guest confirm `200, 409`; guest cancel `200, 409`; confirmed ICS is downloadable.
- `backend-state-flow.json`: reschedule `200, 409`, owner approval, confirmation, reminder, completion all succeed in order.
- `axe-owner.json` and `local-browser-audit.json`: zero serious/critical axe findings on desktop and 390px owner views; no mobile horizontal overflow. `keyboard-resize-audit.json` records the designed 3px focus ring and no overflow at 200% text.
- The full browser suite verifies service-worker-controlled offline `/demo` reload and no demo API request, cookies, or third-party request.

## Run and deploy

```sh
npm ci
npm test
npm run check
npm run build
npm run test:e2e
cargo build --release --locked
docker build --build-arg BUILD_SHA=$(git rev-parse HEAD) -t guest-booking-confirm .
docker run --rm -p 8080:8080 -v gbc-data:/data guest-booking-confirm
```

The container needs only `PORT` (default `8080`) and persists SQLite under `/data`. It runs as non-root. The factory deployment is an Azure Container Apps container build using `BUILD_SHA`; deployment identity must be verified at `/health` after rollout.

## Deployment evidence

- ACR run `chkb` succeeded from the final runtime source commit `07b9d31a44b71c47ff4a1b35d56e290d64784be3`; the upload log confirms `.git` was excluded.
- Azure Container App revision `sf-guest-booking-confirm--0000004` is provisioned with `sociobotregistry.azurecr.io/sf-guest-booking-confirm:07b9d31a44b7` and retains only `PORT=8080`.
- Live `https://guest-booking-confirm.sociobot.in/health` returns `{"build_sha":"07b9d31a44b71c47ff4a1b35d56e290d64784be3","status":"ok"}`.
- Live Chromium smoke at 1440px and 390px found the correct landing h1, no console errors, no horizontal overflow, and a 44px-high owner-setup link. The public response still carries the expected CSP, nosniff, frame denial, and same-origin referrer policy headers.

## Known gaps

The local worker image has no Docker executable, so the Docker build is delegated to the factory ACR build. All equivalent frontend production, locked Rust release, runtime, and browser checks passed locally.

---

# Guest Booking Confirm — repair handoff

Date: 2026-08-28  
Work order: `guest-booking-confirm-repair-1`  
Repaired source commit: `fad50366bf307eeeb5bc6cdd21d19a34b8e9d709`

## Release-blocking repair

This repair addresses every finding in independent report `verification-1.md` against candidate `57dab139c961a5ad93a1a224155b4ae6d5c11a76`.

- Added `/demo`, a one-click guest-confirmation sandbox seeded with Maya Chen's approved Northstar Barber appointment. Its only state is `localStorage` key `demo:guest-booking-confirm:state`; it never reads or writes the owner SQLite database and makes no booking API request. The persistent banner includes **Reset demo** and **Start for real**.
- Reworked the cold, unconfigured landing state around the guest job: **Request and confirm guest appointments**, who it is for, a primary **Try it with sample data** action, and three plain facts. The configured guest page also exposes the sample action.
- Added the required claims contract, demo documentation, and plain-language copy audit. Every listed claim has a clean-browser `/demo` Playwright test.
- Added title/canonical/Open Graph/Twitter metadata, original 1200×630 social artwork derivative and 180px touch icon, `robots.txt`, `sitemap.xml`, a `staticwebapp.config.json`, designed status-404 page, and server routes that return an actual HTTP 404 rather than an SPA-shell 200.
- Added `Cache-Control: public, max-age=31536000, immutable` for `/assets/*` and `no-cache` for HTML/service-worker entry points while preserving the existing CSP and security headers.
- Preserved the owner setup, no-account guest request, owner approval, guest confirmation, calendar, DST, rate-limit, billing, privacy, and retention behavior that had already passed.

## Regression coverage and evidence

- `npm ci`: passed; 0 vulnerabilities reported.
- `npm test`: passed — 4 Vitest tests and 3 Rust unit tests.
- `npm run check`: passed — strict TypeScript and `cargo clippy -- -D warnings`.
- `npm run build`: passed — `dist/` includes the app and designed 404; initial JS is 36.18 kB (11.37 kB gzip), CSS is 19.65 kB (5.21 kB gzip).
- `cargo build --release --locked`: passed.
- `npm audit --omit=dev`: passed — 0 vulnerabilities.
- `npm run test:e2e`: passed — 11 checks. It covers the existing booking workflow, desktop and iPhone-13/390px sample flows, axe serious/critical scan, claims, actual 404 status/body, immutable assets, and offline reload after service-worker control.
- Claim commands listed in `.factory/claims.json` run from `/demo`; `npm run test:e2e -- --grep @claim:demo-confirmation-trail` passed on desktop and 390px. The full browser run passed the local-only and no-tracking-cookie claim tests as well.
- Direct runtime HTTP evidence: `/health` returned `200 {"build_sha":"dev","status":"ok"}`; `/` returned `Cache-Control: no-cache`; the hashed JS returned `Cache-Control: public, max-age=31536000, immutable`; a nonexistent URL returned HTTP 404 and the designed 404 body.
- Lighthouse mobile on `/demo`: Performance **99**, Accessibility **100**, LCP **1.4 s**, CLS **0**. Raw report: `.factory/qa-artifacts/lighthouse-repair.json`.

## Run, verify, and deploy

```sh
npm ci
npm test
npm run check
npm run build
npm run test:e2e
cargo build --release --locked
docker build --build-arg BUILD_SHA=$(git rev-parse HEAD) -t guest-booking-confirm .
docker run --rm -p 8080:8080 -v gbc-data:/data guest-booking-confirm
```

The container still requires only `PORT` (default `8080`) and owns its SQLite data under `/data`. The factory deployment uses Azure Container Apps with `PORT=8080`; the build identity is passed through `BUILD_SHA`.

## Deployment evidence

- ACR build run `chg0` succeeded on 2026-08-28. It built `sociobotregistry.azurecr.io/sf-guest-booking-confirm:808152f0c1e3` from the committed source archive with `.git` excluded.
- Azure Container App revision `sf-guest-booking-confirm--0000001` is `Healthy`, `Provisioned`, and receives 100% traffic with that image.
- Public `https://guest-booking-confirm.sociobot.in/health` returns `{"build_sha":"808152f0c1e32cb0624439cad5a5f591ec27d603","status":"ok"}`.
- The public custom domain returns the designed 404 with HTTP 404 and immutable caching for its hashed JS. Live Chromium smoke checks at 1440×900 and 390×844 each opened `/demo`, found the persistent demo banner, confirmed the sample booking, and recorded zero console errors.

## Known gaps

- No product gap remains from the verifier report.
- The local environment has no Docker daemon; the factory ACR build/deployment is the container validation path. Checkout verification still requires a registered Sociobot test license, as it did before this repair.
