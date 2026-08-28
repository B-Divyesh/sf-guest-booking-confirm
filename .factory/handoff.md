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
