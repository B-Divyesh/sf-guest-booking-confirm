# Guest Booking Confirm — independent verification 15: **FAIL**

Date: 2026-08-30 UTC

Work order: `guest-booking-confirm-verify-15`

Candidate: `84b4436fb02452d71b09daaedfa0e86cc4cdf1db`

Live URL: <https://guest-booking-confirm.sociobot.in>

## Decision

**FAIL — do not release this deployment.** The source candidate passes its local
quality and claim suites, and production serves that exact build, but production
violates two mandatory backend contracts: it runs three replicas with no durable
`/data` mount, and its per-client API allowances are multiplied across those
replicas. Real booking state can be split or lost, and a client can exceed the
documented 40-read/12-write limits without receiving `429`.

## Release-blocking findings

### Critical — production has three replicas and no persistent booking volume

Fresh read-only Azure inspection returned:

- image `sociobotregistry.azurecr.io/sf-guest-booking-confirm:84b4436fb024`;
- revision mode `Single`, but `minReplicas: 1`, `maxReplicas: 3`;
- three running replicas for active revision
  `sf-guest-booking-confirm--0000042`;
- `volumes: null` and `volumeMounts: null`.

The application stores owner settings, bookings, consent, paid state, page
counts, and rate-limit events in SQLite under `/data`. Without the Azure Files
mount, each replica has isolated ephemeral state. Scaling and revision changes
can therefore split or erase the real appointment trail. This breaks the core
job-to-be-done and contradicts the public README/container claim.

Evidence: [`verify15-live-topology.txt`](verification-artifacts/verify15-live-topology.txt).

### Critical — live rate limits do not enforce the documented allowance

The published contract says 40 reads and 12 writes per client in a rolling
second, followed by `429` and `Retry-After: 1`. Fresh same-client bursts showed:

- standard release probe: 41 reads → **41×200, 0×429**;
- two repeat 41-read probes → **41×200, 0×429** each;
- 81 reads → **81×200, 0×429**;
- 200 reads in 819 ms → **120×200, 80×429**;
- 13 page-view writes → **13×204, 0×429**;
- 30 page-view writes → **30×204, 0×429**;
- 37 page-view writes → **35×204, 2×429**.

The 429 responses that eventually appeared did include `Retry-After: 1`, but
the observed deployed allowance was about 120 reads and at least 35 writes,
not 40 and 12. This is consistent with three independent replica-local SQLite
ledgers and directly fails the mandatory server-endpoint test.

Evidence: [`verify15-live-rate-limit.txt`](verification-artifacts/verify15-live-rate-limit.txt).

### Minor — invalid email recovery text is inaccurate

In the independent local UI flow, after a time, consent, name, and invalid email
were entered, submission announced “Complete the required fields and choose a
time.” The time and required fields were already present; the message did not
identify the invalid email. Correcting the email allowed recovery. The backend
itself returns the clearer “Enter a valid email address.”

Evidence: [`verify15-local-ui-audit.txt`](verification-artifacts/verify15-local-ui-audit.txt).

## Required first-read and demo gate — PASS

A fresh production context was opened at 1440×900 and 390×844 and allowed to
reach network idle. The first screen says:

- what: **“Request and confirm guest appointments.”**
- for whom: **“For microbusinesses that approve time requests before each guest
  gets a clear booking status.”**
- first click: **“Try it with sample data”**, with the adjacent explanation
  **“Opens Maya’s approved request at the guest confirmation step.”**

The three facts and primary action are above the fold at both widths. One click
opened the ready-to-confirm Maya Chen sample. Confirmation, reset, and the ICS
download worked. The persistent banner identifies the demo and provides Reset
demo and Start for real.

Evidence: [`verify15-live-audit.json`](verification-artifacts/verify15-live-audit.json),
[`verify15-live-desktop.png`](verification-artifacts/verify15-live-desktop.png),
[`verify15-live-mobile390.png`](verification-artifacts/verify15-live-mobile390.png),
and [`verify15-live-demo-mobile390.png`](verification-artifacts/verify15-live-demo-mobile390.png).

## Claims gate — 26/26 PASS locally

After `npm ci` installed 85 packages with zero audit vulnerabilities, every
`test` command in `.factory/claims.json` was invoked separately. All passed:

| Claim | Result |
| --- | --- |
| `demo-confirmation-trail` | PASS |
| `appointment-status-preview` | PASS |
| `demo-local-only` | PASS |
| `offline-reload` | PASS |
| `no-tracking-cookies` | PASS |
| `anonymous-page-view-count` | PASS |
| `service-storage-inventory` | PASS |
| `guest-no-account` | PASS |
| `owner-approval-before-booking` | PASS |
| `copy-private-booking-link` | PASS |
| `private-booking-link-security` | PASS |
| `guest-rescheduling` | PASS |
| `guest-cancellation` | PASS |
| `confirmed-calendar-ics` | PASS |
| `manual-reminder-checklist` | PASS |
| `free-desk-capacity-and-retention` | PASS |
| `panel-pro-capacity-and-retention` | PASS |
| `panel-pro-checkout` | PASS |
| `browser-license-storage` | PASS |
| `revoked-license-fallback` | PASS |
| `generated-artwork-provenance` | PASS |
| `api-rate-limit` | PASS locally; **fails live** as detailed above |
| `health-build-identity` | PASS |
| `owner-entra-identity` | PASS |
| `first-owner-setup` | PASS |
| `container-runtime-contract` | PASS locally; **deployed topology fails** |

Evidence: [`verify15-claims-summary.txt`](verification-artifacts/verify15-claims-summary.txt).

## Local build and end-to-end results

- `npm test`: PASS — 4 Vitest, 21 Rust, 1 claims-contract, and 5
  deployment/release-contract tests.
- `npm run check`: PASS — TypeScript and Clippy with warnings denied.
- `cargo fmt --all -- --check`: PASS.
- `npm run build`: PASS; `dist/` produced.
- `cargo build --release --locked`: PASS; binary 14,317,440 bytes.
- `npm run test:e2e`: PASS — 23 Chromium workflows.
- `npm run test:billing`: PASS within the claims run — live Sociobot catalog,
  USD 29.00 price, and hosted checkout redirect; no purchase made.

Independent local coverage used a fresh SQLite database. It verified first
owner exclusivity, unauthenticated rejection, invalid names/emails/consent and
past times, request → approval → keyboard confirmation, single-use concurrent
confirmation (200/409), colliding approvals (200/409), ICS, reschedule,
cancellation, manual reminder, invalid-token recovery, 100 concurrent reads,
and persistence after a graceful process restart. DST checks skipped nonexistent
spring 02:00 times and ambiguous fall 01:00 times while keeping unique UTC
instants.

Evidence: [`verify15-backend-audit.json`](verification-artifacts/verify15-backend-audit.json),
[`verify15-backend-persistence.json`](verification-artifacts/verify15-backend-persistence.json),
[`verify15-dst.json`](verification-artifacts/verify15-dst.json), and
[`verify15-local-ui-audit.txt`](verification-artifacts/verify15-local-ui-audit.txt).

The container CLI was unavailable in this verifier image, so a fresh Docker
image was not built locally. The release build, static Docker contract test,
and exact live candidate image supplied equivalent build/runtime evidence.

## Live identity, privacy, PWA, accessibility, and performance

- `/health` returned the exact candidate SHA. Live `index.html`, initial JS,
  and CSS were byte-for-byte identical to local `dist/`.
- Root HTML is `no-cache`; hashed JS is one-year immutable; `sw.js` is
  `no-cache`. CSP, `nosniff`, `DENY`, same-origin referrer policy, and restrictive
  permissions headers were present.
- A direct demo confirmation made only same-origin requests, made no API
  requests, set no cookies, and wrote only
  `demo:guest-booking-confirm:state`. The normal landing request was also
  same-origin only.
- The service worker updated, became the active controller after reload, and
  reloaded the ready-to-confirm demo offline from `gbc-shell-v5`.
- Owner access contained no product password field and redirected only through
  the configured authority
  `sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650`.
- Playwright axe found zero serious/critical issues on landing, demo, privacy,
  terms, owner, and 404 states. Valid routes had one `h1`, one `main`, `lang=en`,
  no console/page errors, no horizontal overflow, and no visible target below
  44 px. Keyboard-only use reached the skip link, main, sample action, and demo
  confirmation. At 200% text size the 390 px page had no horizontal overflow.
  Reduced motion changed scroll behavior to `auto`.
- The factory URL verifier passed in 782 ms with no errors.
- Initial app JS: 51,530 bytes raw / 15,426 bytes gzip; CSS: 37,150 bytes raw /
  8,497 bytes gzip. The 260 KB auth chunk is lazy and absent from first load.
- Live mobile Lighthouse: performance 98, accessibility 100, best practices
  100, SEO 100; LCP 1.755 s, CLS 0, TBT 153 ms, transfer 170,570 bytes.

Evidence: [`verify15-deployment-and-sizes.txt`](verification-artifacts/verify15-deployment-and-sizes.txt),
[`verify15-live-demo-privacy.txt`](verification-artifacts/verify15-live-demo-privacy.txt),
[`verify15-live-pwa.txt`](verification-artifacts/verify15-live-pwa.txt),
[`verify15-live-identity.txt`](verification-artifacts/verify15-live-identity.txt),
[`verify15-keyboard-mobile.txt`](verification-artifacts/verify15-keyboard-mobile.txt),
[`verify15-site-crawl.txt`](verification-artifacts/verify15-site-crawl.txt),
[`verify15-lighthouse-summary.txt`](verification-artifacts/verify15-lighthouse-summary.txt),
and [`verify15-verify-url/verify.json`](verification-artifacts/verify15-verify-url/verify.json).

## Required release action

Deploy through the repository’s guarded `npm run deploy` path, then require the
final topology check to show one running replica, `maxReplicas: 1`, and the
Azure Files volume mounted at `/data`. Re-run the 41-read and 13-write live
bursts three times. Do not accept until each returns exactly 40/1 and 12/1 with
`Retry-After: 1`, and a persisted booking survives a revision restart.

No product code was modified during this verification.
