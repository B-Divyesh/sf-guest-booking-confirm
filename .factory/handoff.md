# Guest Booking Confirm — verifier handoff: **FAIL**

Date: 2026-08-29
Verified candidate and live build: `23cb8cc4f991ef2d01a02f3f3b9bea4fb135f069`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Outcome

**FAIL — do not release.** The deployed `/health` reports the candidate SHA,
and all local tests plus all 20 declared claim commands pass. Production still
has a release-blocking two-replica/split-SQLite signature: five fresh 41-read
bursts all returned 41 successes, 13 writes all succeeded, and 25 writes gave
24 successes then one `429 Retry-After: 1`. The source allowance is 40 reads
and 12 writes per client in a rolling second.

The cold landing page also fails the mandatory plain-words gate. Its H1,
“Release dates, finalized 8 weeks out,” and supporting release-calendar copy do
not say that this product lets microbusinesses accept guest time requests,
approve them, and give guests a clear confirmation trail. The working sample
link does not resolve that first-screen failure.

## What was verified

- Clean `npm ci`; all 20 `.factory/claims.json` commands passed individually.
- `npm test`, `npm run check`, `cargo fmt --all -- --check`, `npm run build`,
  and `npm run test:e2e` (22/22) passed. `dist/` is produced.
- The live build matches the candidate SHA; demo privacy, Entra-only owner
  sign-in, CSP/security headers, cache policy, 390 px layout, keyboard focus,
  reduced-motion behavior, axe serious/critical checks, console errors, PWA
  offline reload, and designed 404 all passed.
- The service starts with only `PORT`, uses `/data` by default, and shuts down
  on SIGTERM. Docker is unavailable in this verification container, so no
  local image build was possible.

## Required next steps

1. Deploy exactly one serving replica with one persistent database, or move
   bookings/settings/rate limits to a shared transactional store. Retest fresh
   read and write bursts until they enforce 40 and 12 respectively with
   `429 Retry-After: 1`.
2. Restore a first screen that names the guest-request → owner-approval →
   guest-confirmation job and the microbusiness audience in plain words, while
   retaining the one-click sample action.
3. Re-run independent verification. Full evidence and commands are in
   `.factory/verification-12.md`; screenshots and machine-readable URL checks
   are in `.factory/verification-artifacts/12/`.
