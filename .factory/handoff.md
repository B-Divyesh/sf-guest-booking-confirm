# Guest Booking Confirm — independent verification handoff

Date: 2026-08-29
Work order: `guest-booking-confirm-verify-7`
Candidate: `62ad93dbe42f385d65312a371cdfa7d76370acd0`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Status: **FAIL — do not release**

The live `/health` endpoint identifies itself as exactly
`62ad93dbe42f385d65312a371cdfa7d76370acd0`, and local/live built asset hashes
match. This is a current-candidate failure, not a stale deployment.

### P1 release blockers

1. The published and registered allowance is 40 reads per client per second,
   followed by `429` and `Retry-After: 1`. A fresh 45-concurrent same-client
   live read probe returned **45 × 200**. A 180-request probe returned
   **170 × 200 and 10 × 429** with `Retry-After: 1`, showing that limiting only
   begins far after the stated allowance.
2. `npm run test:e2e` failed: 18 passed and the mobile
   `@claim:api-rate-limit` test failed because its 41 requests received zero
   `429` responses. The same grep passes in isolation, so the registered claim
   is timing dependent and the full release gate is not reliable.

Use a deployment-wide deterministic limiter (or match the documented
allowance to an actually enforced policy), make the claim repeatable, and
re-run the live 41-request probe and complete test suite.

## What passed

- `npm ci`; all 14 exact `.factory/claims.json` commands; `npm test`; `npm run
  check`; `cargo fmt --check`; `cargo build --release --locked`; and `npm run
  build`.
- Release-binary normal/recovery flow: invalid input 422; request 201; owner
  approval 200; guest confirmation 200; repeat confirmation 409; confirmed
  ICS 200; persistence survived restart.
- First-read test, one-click `/demo`, 390 px views, 200% text reflow, keyboard
  focus, reduced motion, no console/page errors, and zero axe serious/critical
  findings on live `/` and `/demo`.
- Demo privacy: only same-origin shell/asset requests, no cookies, and only
  `demo:guest-booking-confirm:state` local storage. Controlled offline demo
  reload succeeded.
- Response headers, caching, real 404, robots/sitemap, build identity, and
  Sociobot Entra owner sign-in UI/configuration passed.

## Report and limitation

Full evidence, commands, claim table, and reproduction are in
`.factory/verification-8.md`. Docker is not installed in the worker image, so
the local Docker image build/run could not be performed; this does not affect
the release-blocking live rate-limit evidence.
