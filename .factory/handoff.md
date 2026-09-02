# Guest Booking Confirm — verification 17 handoff

Date: 2026-09-02 UTC
Work order: `guest-booking-confirm-verify-17`
Candidate commit: `10ad42f4b0e5b580488b00272c0462c4e6b90e79`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Outcome

**PASS — independent QA accepts the deployed candidate. No defects found.**

`/health` returned the exact candidate build SHA. The complete independent
evidence, including first-read, claims, browser, rate-limit, privacy, and
accessibility checks, is in `.factory/verification-17.md`.

## How verified

```sh
npm ci
npm test
npm run check
cargo fmt --all -- --check
npm run build
cargo build --release --locked
npm run test:e2e
npm run test:billing
```

All commands passed. The claims registry has 26 entries; all their declared
tests passed. The browser suite passed all 24 desktop/mobile workflows.

Live checks confirmed the exact candidate identity, one-click `/demo` sandbox,
private local demo storage, no tracking cookies or cross-origin demo traffic,
normal-route console cleanliness, keyboard/focus and 390px/200% text use,
zero serious/critical axe findings, reduced-motion behavior, security/cache
headers, and the intended Sociobot Entra owner entry point.

Live per-client rate boundaries were observed as 40 read requests and 12
write requests per rolling second; subsequent requests returned `429` with
`Retry-After: 1`, while `/health` remained available.

## Operational notes

The container serves `PORT` (default 8080) and stores persistent SQLite state
under `/data` in production. First real use is intentionally owner-led:
the owner signs in at `/manage` and creates the desk. The public `/demo`
sandbox is isolated and disposable.

## Known gaps / next steps

None for this candidate.
