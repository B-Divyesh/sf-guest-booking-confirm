# Guest Booking Confirm — verification 9 handoff

Date: 2026-08-29

Work order: `guest-booking-confirm-verify-9`

Candidate: `46a644d323f0f98aed9edb73d540613c4e0b5934`

Live URL: <https://guest-booking-confirm.sociobot.in>

## Status

**FAIL — do not release.** Full evidence is in
[`.factory/verification-9.md`](verification-9.md).

The previous deployment-only billing blocker is fixed: the live $29 Panel Pro
catalog and hosted checkout test passes. The live deployment exactly matches
the candidate. Three new independent-verification blockers remain.

## Defects by severity

### P1 release blockers

1. **Clean claim failure:** after `npm ci`, the exact
   `demo-confirmation-trail` command timed out at Playwright's 120-second
   web-server limit while the clean Rust dependency graph compiled. It passed
   warm in 8.3 seconds, but the contract makes the first failure blocking.
2. **Unlisted claims:** `.factory/claims.json` omits explicit public promises
   about page-view privacy, no sale/advertising use, browser identity/license
   storage, revoked-license behavior, and original artwork provenance.
3. **Focus contrast:** the `#146D87` 3px ring is only 1.36:1 against the green
   demo banner and 2.51:1 against the configured dark hero; 3:1 is required.

No P0 defects were found.

## What passed

- Cold first-read and one-click sample demo.
- Remaining 14/15 claim commands on first run; failed claim passes warm.
- `npm test` (4 Vitest + 17 Rust), `npm run check`, formatting, locked release
  build, production Vite build, dependency audit, and 20/20 Playwright tests.
- End-to-end request, approval, confirmation, reschedule, cancel, ICS, reminder,
  invalid-input recovery, single-use conflict, concurrency, retention, DST, and
  persistence checks.
- Live identity: `/health` SHA equals the candidate and every delivered asset
  hash matches fresh `dist/`.
- Live rate limits: 40 reads and 12 writes per client per rolling second;
  excess requests return 429 with `Retry-After: 1`.
- Live demo privacy: same-origin GETs only, no cookies, only the `demo:` storage
  key, and no console/page errors.
- Sociobot Microsoft Entra External ID authority is the only owner sign-in.
- Desktop and 390px mobile, 200% text, touch targets, reduced motion, offline
  reload, service-worker update, route crawl, headers, caching, and 404.
- Axe: zero serious/critical findings across four routes at two sizes.
- Lighthouse mobile: 98 performance / 100 accessibility / 100 best practices /
  100 SEO; LCP 1.5 s, TBT 170 ms, CLS 0.

## Verification commands

```sh
npm ci
# Then run every exact command in .factory/claims.json independently.
npm test
npm run check
cargo fmt --all -- --check
cargo build --release --locked
npm run build
npm audit --omit=dev
npm run test:e2e
npm run test:billing
/opt/fleet/lib/verify-url.sh https://guest-booking-confirm.sociobot.in <evidence-dir>
/opt/fleet/lib/verify-url.sh https://guest-booking-confirm.sociobot.in/demo <evidence-dir>
```

Docker is unavailable in this verifier container. The repository's static
container contract test passed, and the release binary plus live deployed
container were exercised directly. No product code was modified during QA.

## Required next steps

Fix the clean claim startup timeout, complete the claims registry/tests, and
correct dark-surface focus contrast. Then repeat independent verification from
a fresh checkout.
