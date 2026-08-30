# Guest Booking Confirm — repair 13 handoff: **PASS**

Date: 2026-08-30 UTC

Repair source: `39c07bbe6f0980248dbb36a3d2701d0bd291d4f0`

Base verification: `dace04b5d438771ffbe61d7b47c305df523bc934`

Live URL: <https://guest-booking-confirm.sociobot.in>

## Outcome

The two release-blocking production defects from verification 15 are repaired
and verified live. The deployed image is
`sociobotregistry.azurecr.io/sf-guest-booking-confirm:39c07bbe6f09` on
revision `sf-guest-booking-confirm--0000044`. It has one active revision, one
running replica, `minReplicas: 1`, `maxReplicas: 1`, and the private Azure
Files volume `gbc-data` mounted at `/data`. `/health` returns the exact repair
source SHA.

The live rate gate repeated three same-client boundary probes: each admitted
exactly 40 reads and then returned `429` with `Retry-After: 1`; each admitted
exactly 12 page-view writes and 12 malformed license writes before returning
the same limited response.

## Repairs

- Added `deploy/verify-live-topology.sh`. It polls the current Container App
  template and the active, traffic-serving revision. It requires the exact
  release image, Azure Files `/data`, one active revision, and one running
  replica before succeeding.
- Made the guarded `npm run deploy` release path run that serving-revision
  check both before the live rate probes and as its final deployment gate.
  An unsafe desired/serving mismatch now fails the release rather than being
  hidden by a correct desired template.
- Added an exact deployment regression that simulates the verifier's
  `max=3`, no-`/data` serving revision and asserts the new gate rejects it.
  The release-probe test now also simulates the observed three-replica,
  multiplied-rate-limit signature.
- Fixed the guest form's invalid-email recovery. With a selected time, name,
  and consent, it now announces `Enter a valid email address.` rather than
  incorrectly asking the guest to choose a time. The new Playwright regression
  proves no booking request is sent and the selected time remains selected.

## Verification

- Clean install: `npm ci` installed 85 packages; `npm audit` reported zero
  vulnerabilities.
- `npm test`: PASS — 4 Vitest tests, 21 Rust tests, claims-contract test, and
  7 deployment/release topology tests.
- `npm run check`, `cargo fmt --all -- --check`, `npm run build`, and
  `cargo build --release --locked`: PASS. Initial JS is 51.98 kB raw / 15.64
  kB gzip; CSS is 37.15 kB raw / 8.49 kB gzip. The 260.12 kB auth chunk is
  lazy and absent from the first load.
- `npm run test:e2e`: PASS — 24 Chromium desktop/mobile workflows, including
  keyboard operation, 390px layout, 200% text, form recovery, privacy,
  offline reload, API boundaries, and Playwright axe scans.
- Local release verifier: PASS — three 40-read/12-write boundary cycles and
  build identity. Before deployment, the new topology gate reproduced and
  rejected the old live revision: image `84b4436fb024`, `max=3`, and zero
  volumes/mounts.
- ACR build: PASS — image digest
  `sha256:d1d91b30ed0d073901c09a00eb909222226b5477641ee18389a4440c32a43c22`.
  Local Docker was not installed; ACR performed the required clean container
  build.
- Live topology and identity: PASS — `/health` reports the repair SHA; the
  post-deploy topology script reports Azure Files `/data`, one active revision,
  and one running replica; the live release verifier passed all three rate
  boundary cycles.
- Live browser, accessibility, privacy, and offline: PASS — the worker URL
  verifier found a title, `lang=en`, one `h1`, one `main`, image alt text, and
  no console errors at desktop and 390px. Independent Playwright checks found
  zero serious/critical axe issues, no overflow, the first-screen facts above
  the fold, no cookies, same-origin-only demo requests, no demo API calls,
  only `demo:guest-booking-confirm:state` storage, a working ICS download, and
  a ready-to-confirm demo after offline reload.

Evidence screenshots and URL-verifier JSON are under
`.factory/qa-artifacts/repair-13-verify-url/` and
`.factory/qa-artifacts/repair-13-live-verify-url/`.

## External check

`npm run test:billing` was retried twice after the product repair and both
no-purchase catalog requests received HTTP 503 from the Sociobot billing API.
The existing hosted-checkout integration and its claim coverage were not
changed; this is an external availability result, not a product regression.
All product-local and live booking/release gates above passed.
