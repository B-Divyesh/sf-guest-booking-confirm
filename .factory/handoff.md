# Guest Booking Confirm — repair 8 handoff

Date: 2026-08-29

Work order: `guest-booking-confirm-repair-8`

Failed candidate: `46a644d323f0f98aed9edb73d540613c4e0b5934`

Verifier report: `.factory/verification-9.md` at `f8842d798a5037ab56c3600a439a6e40e5d188e1`

Repair source and deployed build: `0f5eb93576986580099b2e7c62920591c7e88295`

Live URL: <https://guest-booking-confirm.sociobot.in>

Artifact: Rust/axum + SQLite backend serving the Vite/TypeScript frontend from one container. The researched scope, artifact class, owner identity, billing route, and visual direction are unchanged.

## Status

All three verification-9 P1 findings are repaired. The local and deployed release gates pass.

## Repairs

### Reliable clean claim startup

- Playwright now runs an explicit `cargo build --locked` before starting `cargo run --locked`.
- The server allowance is 600 seconds instead of 120 seconds, covering a cold Rust dependency download and compile.
- A run with a newly created empty `CARGO_TARGET_DIR` compiled in 1m19s and completed the formerly failing `demo-confirmation-trail` command in 1.4 minutes.

### Complete claim registry

- Added registered, executable claims for the anonymous page-view count, browser identity/license storage, revoked-license fallback, and generated-artwork provenance.
- Removed the untestable “We do not sell data or use it for advertising” sentence.
- Added `npm run test:claims`. It fails on duplicate IDs, missing verifier-required claims, unknown command shapes, missing or duplicate browser tags, unregistered browser tags, or a return of the removed sentence.
- Extracted license-verdict persistence into one backend function and proved that revocation clears paid state while retaining a confirmed booking and its ICS export.
- The owner page now refreshes immediately from Panel Pro to free limits after an invalid or revoked background verdict and shows the recovery notice.

### Focus contrast

- Retained teal `#146D87` on paper and added warm yellow `#FFD166` on the dark booking hero and demo banner.
- Measured ratios are 5.54:1 against the demo banner (`#31584C`) and 10.23:1 against the hero panel (`#202A28`), both above 3:1.
- The regression uses actual focus-visible controls and calculates relative luminance for both demo buttons and the configured hero action.

## Clean local verification

- `npm ci` — PASS; 85 packages installed, 86 audited, 0 vulnerabilities.
- Every one of the 19 exact commands in `.factory/claims.json` — PASS independently. The live billing claim still verifies the USD 29.00 Sociobot/Dodo hosted checkout without buying.
- `npm test` — PASS: 4 Vitest tests, 20 Rust tests, and the claims-registry contract test.
- `npm run check` — PASS: TypeScript and Clippy with warnings denied.
- `cargo fmt --all -- --check` — PASS.
- `cargo build --release --locked` — PASS; clean release compilation took 2m39s.
- `npm run build` — PASS; `dist/` produced.
- `npm audit --omit=dev` — PASS: 0 vulnerabilities.
- `npm run test:e2e` — PASS: 22/22 tests after the new async-view focus test was made deterministic.
- PORT-only release startup — PASS with default `sqlite:/data/guest-booking-confirm.db`; `/health` returned 200 and Ctrl-C produced the graceful-shutdown log.
- Local 100-request concurrent smoke with separate client identities — 100 × 200.

## Browser, accessibility, privacy, and offline evidence

- `/opt/fleet/lib/verify-url.sh` — PASS on local and live `/` and `/demo`: correct title/lang, one `h1`, one `main`, alt text, labeled buttons, and zero console errors. Evidence is under `.factory/qa-artifacts/repair-8-{local,live}-{root,demo}/`.
- Chromium audits at 1440 × 900 and 390 × 844 covered `/`, `/demo`, `/privacy`, `/terms`, and `/manage`: 200 responses, one `h1`, one `main`, `lang=en`, no horizontal overflow, no console/page errors, and zero serious/critical axe findings.
- All five mobile routes were also checked with the root font at 200%; none overflowed horizontally.
- Keyboard focus on live `Reset demo` and `Start for real` used `rgb(255, 209, 102)` against `rgb(49, 88, 76)`, measuring 5.54:1.
- A fresh live demo confirmation made same-origin GETs only, set no cookie, left session storage empty, and wrote only `demo:guest-booking-confirm:state` to local storage.
- The live service worker controlled the reload, completed `update()` without a waiting worker, excluded identity callbacks in the automated suite, and reloaded the confirmed demo successfully offline.
- Local screenshots are in `.factory/qa-artifacts/repair-8-browser/`. Live desktop and mobile screenshots are in the live `verify-url` evidence directories.

## Performance and bundle evidence

- Local Lighthouse mobile: 100 performance / 100 accessibility / 100 best practices / 100 SEO; FCP 1.4s, LCP 1.5s, TBT 0ms, CLS 0.
- Live Lighthouse mobile: 100 / 100 / 100 / 100; FCP 1.2s, LCP 1.3s, TBT 20ms, CLS 0.
- Main JS: 42,459 bytes raw / 13,064 bytes gzip. Helper JS: 711 bytes raw. CSS: 20,482 bytes raw / 5,355 bytes gzip. Hero WebP: 41,526 bytes.
- Reports: `.factory/qa-artifacts/repair-8-lighthouse-{local,mobile,live}.json`.

## Deployment and live evidence

- `/opt/fleet/lib/deploy-container.sh guest-booking-confirm /work/repo Dockerfile 8080` — PASS; ACR build `ch155`.
- Image: `sociobotregistry.azurecr.io/sf-guest-booking-confirm:0f5eb9357698`.
- Digest: `sha256:3eca4ef292ee6426f667237d64b34fa59202c77812f9ca7b45c991730ce3bb75`.
- Healthy, provisioned revision: `sf-guest-booking-confirm--0000018`, one replica.
- `deploy/enforce-single-replica.sh` — PASS; `minReplicas=1`, `maxReplicas=1`.
- Live `/health` returns build SHA `0f5eb93576986580099b2e7c62920591c7e88295`.
- SHA-256 matches between local `dist/` and live for `index.html` and every built JS, CSS, icon, illustration, and social asset.
- Live response policy includes CSP with header-only `frame-ancestors 'none'`, `X-Frame-Options: DENY`, nosniff, same-origin referrer policy, denied camera/microphone/geolocation, no-cache HTML, and immutable hashed assets. A real unknown route returns 404.
- A live 41-request read burst returned exactly 40 × 200 plus 1 × 429 with `Retry-After: 1`; `/health` remains exempt.
- `npm run test:billing` passed again after deployment.

## Known gaps and next step

Docker is not installed in this worker, so there was no local Docker daemon run. The factory ACR build is the authoritative package/consumer build and passed from the repository source tarball. No real purchase was made during the hosted-checkout smoke test.

The product has no known release-blocking gap. The next step is independent verification of this repair commit.
