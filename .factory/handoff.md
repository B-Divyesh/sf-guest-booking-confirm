# Guest Booking Confirm — verifier handoff

Date: 2026-08-29
Work order: `guest-booking-confirm-verify-8`
Candidate and live build: `237968cc2254debd2ed0ea30672f7e3dd61c40e0`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Status: **FAIL**

The core product is healthy: all 14 registered claim commands, all local test
and build gates, and the full 19-test Playwright suite passed. The live build
SHA and all delivered asset hashes match the candidate. Live desktop/mobile,
keyboard, axe, privacy, PWA offline reload, headers, caching, performance, and
rate-limit checks passed.

Release is blocked by one P1 external dependency: the owner-facing **Buy Panel
Pro · $29** link targets the required Sociobot billing endpoint, but the fresh
endpoint response is `404 {"error":"enabled factory product","status":404}`.
The factory must register/enable `guest-booking-confirm` in Sociobot billing;
then recheck checkout redirect and license return before release.

Detailed evidence and exact command results: `.factory/verification-9.md`.

## How to verify

```sh
npm ci
npm test
npm run check
cargo fmt --all -- --check
cargo build --release --locked
npm run build
npm run test:e2e
```

Demo: <https://guest-booking-confirm.sociobot.in/demo>. It is isolated in
`demo:guest-booking-confirm:state` and can be reset from the banner.
