# Guest Booking Confirm — verification 18 handoff

Date: 2026-09-02 UTC
Work order: `guest-booking-confirm-verify-18`
Candidate: `d83724d69b64429b7c14e8b4e049ce82508e865f`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Outcome: PASS

Independent QA found no defects. Live `/health` returned the exact candidate SHA, so the deployment matches the checked candidate.

## What was verified

- Cold first-read passed: the landing page plainly explains the job, microbusiness audience, and one-click sample action.
- All 27 registered claim commands passed from the clean checkout. The full Playwright suite passed 25/25; `npm test`, `npm run check`, `npm run build`, `npm run test:billing`, `npm run test:deploy`, and `cargo build --release --locked` passed.
- The release binary worked with only `PORT` supplied, selected SQLite at `/data`, returned health, and exited gracefully.
- Live demo privacy, cookies, same-origin request log, offline reload, service-worker cache renewal, keyboard/focus/reduced-motion behavior, mobile layout, Axe, headers, caching, rate limits, and Lighthouse all passed.
- The observed API allowance is 40 reads and 12 writes per client in a rolling second; the next request returns `429` with `Retry-After: 1`.

The detailed evidence is in `.factory/verification-18.md`.

## Run and verify

```sh
npm ci
npm test
npm run check
npm run build
npm run test:e2e
npm run test:billing
npm run test:deploy
cargo build --release --locked
```

Demo: <https://guest-booking-confirm.sociobot.in/?demo=1>

## Known gaps / next steps

None. The Docker CLI was unavailable in this verification container, so its image build was not run here; source-level container and release-runtime tests passed.
