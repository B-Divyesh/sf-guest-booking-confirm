# Guest Booking Confirm — review 1 handoff

Date: 2026-08-30 UTC

Work order: `guest-booking-confirm-review-1`

Role: adversarial first-read reviewer
Live URL: <https://guest-booking-confirm.sociobot.in>

## Outcome

**FAIL.** The complete report is in [review-1.md](review-1.md). It records 32 findings: 2 blocking, 12 major, and 18 minor.

The blocking issues are:

1. The landing page's main preview is a hard-coded May/July/December 2025 “release schedule” with eight-week opening and two-week locking rules that the booking backend does not implement.
2. The registered `eight-week-release-board` test passes by asserting that the claim text and a hard-coded status are present; it does not prove either scheduling boundary.

No product code was changed.

## Verification performed

- Opened the live site cold in fresh 390 × 844 and 1440 × 900 Chromium contexts before scrolling.
- Entered `/demo`, confirmed the sample, reset it, exited it, and inspected cookies, local storage, and every request.
- Confirmed the demo writes only `demo:guest-booking-confirm:state`, calls no `/api` route, sets no cookie, resets correctly, and reloads offline after service-worker control.
- Ran all 21 commands in `.factory/claims.json` individually from a clean clone after `npm ci`; all commands passed. The semantic defect in `eight-week-release-board` is documented separately from its passing exit code.
- Ran `npm test`; 4 Vitest tests, 20 Rust tests, the claims contract, and 5 deployment/release tests passed.
- Ran `npm run build`; `dist/` was produced.
- Ran the factory live `verify-url.sh`; it passed with one h1/main, title/lang, alt text, labeled buttons, and no load console errors.
- Ran live Playwright axe checks on `/`, `/demo`, `/privacy`, `/terms`, `/manage`, and a true 404; each had zero serious/critical findings.
- Checked route titles, h1 count, metadata, deep links, browser Back/focus, unknown-route status, robots/sitemap, internal link status, image dimensions, and first-load bundle sizes.
- Read `.factory/brief.json`, `.factory/design.md`, `.factory/claims.json`, `.factory/demo.md`, README, the prior handoff, and all matching review/polish history. No earlier review or polish file existed.

## Reproduction

From a clean clone:

```sh
npm ci
npm test
npm run build
npm run test:e2e -- --grep @claim:eight-week-release-board
```

The last command passes but only checks visible copy. Compare its assertions in `tests/booking-flow.spec.ts` with the hard-coded 2025 board in `frontend/src/app.ts` and the real 14-day slot requests. There is no backend eight-week opening or two-week lock behavior.

## Next steps

Resolve every finding in `review-1.md`, beginning with the stale/unsupported board and claims coverage. Then rerun the review from scratch, including the clean-clone claim list, live demo request log, offline reload, 390 px first screen, route metadata/link crawl, and full copy audit.
