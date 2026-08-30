# Guest Booking Confirm — independent verification: **PASS**

Date: 2026-08-30  
Work order: `guest-booking-confirm-verify-14`  
Candidate: `4f94d2e4f376b7a4440700f746a6313a09e3b92b`  
Live URL: <https://guest-booking-confirm.sociobot.in>

## Decision

**PASS — accept this candidate.** The prior deployment-only rate-limit failure
is repaired: fresh live evidence identifies this exact SHA and proves the
documented limits for three separate client identities.

## Required first-read — PASS

In a cold live browser context, the first screen said **“Request and confirm
guest appointments.”** It said it is **“For microbusinesses that approve time
requests before each guest gets a clear booking status.”** The primary action
was **“Try it with sample data”**, with **“Opens Maya’s approved request at the
guest confirmation step.”** This plainly states the job, audience, and first
click; the action opens isolated `/demo` in one click.

## Claims and local checks — PASS

`.factory/claims.json` is present with 21 declarations. After `npm ci` (85
packages, zero audit vulnerabilities), I invoked every declared command:

- all 14 individual `npm run test:e2e -- --grep @claim:<id>` commands;
- all six individual locked Rust claim tests; and
- `npm run test:billing`, which passed the live USD 29.00 hosted Sociobot
  checkout smoke without purchasing.

The full `npm run test:e2e` rerun reported `status: passed`, zero failed tests
(22 Chromium workflows), confirming all browser claims. The six Rust claim
commands each passed. `npm test` passed (4 Vitest, 20 Rust, claims contract,
five deployment/release-contract tests). `npm run check`,
`cargo fmt --all -- --check`, `npm run build`, and
`cargo build --release --locked` also passed. `dist/` was produced and the
release binary is 14 MB.

Representative end-to-end and boundary coverage includes a guest request with
no account, owner approval, guest confirmation, ICS, reschedule, cancellation,
manual reminder, invalid opening-hours recovery, DST/date validation,
concurrent confirmation/approval, and free-capacity atomicity. With no runtime
configuration other than `PORT=4181`, the server used its `/data` SQLite
default, returned `/health` 200, logged generated/default configuration, and
exited cleanly on SIGTERM.

## Live backend and privacy evidence — PASS

- `/health` returned build SHA exactly
  `4f94d2e4f376b7a4440700f746a6313a09e3b92b`. Live root HTML matched local
  `dist/index.html` at SHA-256
  `d6105c92c7c6bcf39a68fc308eaf50a39b51084fb5ff2fce6976b8e024b5b1e0`.
- Three fresh-client repetitions each returned exactly 40 settings reads then
  `429 Retry-After: 1`; exactly 12 page-view writes then `429 Retry-After: 1`;
  and exactly 12 malformed license-verification writes then
  `429 Retry-After: 1`. Observed allowance: 40 reads and 12 writes per client
  per rolling second.
- A fresh live demo confirmed successfully and exposed calendar download.
  It set no cookie, made no API/action request, used only
  `demo:guest-booking-confirm:state`, and made only same-origin requests.
  Separate 390 px contexts successfully rescheduled and cancelled. The service
  worker was controlling the page; `registration.update()` succeeded, cache
  `gbc-shell-v4` existed, and `/demo` reloaded ready to confirm while offline.
- Headers include `nosniff`, `DENY`, same-origin referrer policy, denied
  camera/microphone/geolocation, and CSP response-header `frame-ancestors
  'none'`. HTML is `no-cache`; hashed main JS is immutable for one year. The
  unknown-route response is the designed 404. Owner sign-in has no password
  and targets `sociobotcustomers.ciamlogin.com`.

## Accessibility, mobile, and performance — PASS

- `verify-url.sh` passed live `/` (725 ms) and `/demo` (582 ms): title,
  `lang=en`, one h1, main, alt text, labelled controls, and no errors.
- Live axe found zero serious/critical findings on `/`, `/demo`, `/privacy`,
  `/terms`, and `/manage`; each had one h1 and one main. At 390 px, keyboard
  skip/focus worked, reduced motion set scroll behavior to `auto`, there was
  no horizontal overflow, and persistent demo targets were 48 px high.
- Main JS is 49,006 bytes raw / 14,946 bytes gzip; CSS is 36,877 raw / 8,436
  gzip. Live Lighthouse was performance 98, accessibility 100, best practices
  100, SEO 100; LCP 1.8 s, CLS 0, TBT 160 ms.

## Defects by severity

None found. No product code was modified during verification.
