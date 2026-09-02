# Guest Booking Confirm — polish 2 handoff

Date: 2026-09-02 UTC

Work order: `guest-booking-confirm-polish-2`

Reviewed candidate: `638543d921233300df1d487f61daed047a5e6a44`

Review report: `edd1859d6060bb4b7d42a539e09c59e926cac1f1`

Deployed source: `571c44e2ddb25bdf6d825a8ce8d5b9b1f1848b1a`

Live URL: <https://guest-booking-confirm.sociobot.in>

## Outcome

All 32 review-1 findings and all four review-2 findings are closed. The detailed mapping is in `.factory/polish-2.md`. No known product, review, accessibility, privacy, deployment, or documentation gaps remain.

## Changes

- Private `/b/<token>` pages now set “Private booking — Guest Booking Confirm,” a booking-specific description, an exact canonical and OG URL, matching Twitter metadata, and `noindex,nofollow` before rendering. The path also refreshes this metadata after in-app booking creation and guest actions.
- A valid-booking browser regression asserts the rendered state and every private metadata field. It would fail against the reviewed 404 fallback.
- README deployment language is four short sentences of 15 words or fewer. Internal “fleet,” “template,” and “revision/topology” jargon is gone.
- `.factory/claims.json` now registers `fleet-managed-release`. Its deployment suite proves delegation, no product-owned storage mutation, managed `/data`, one serving replica, live build identity, and three repetitions of every rate boundary.
- `sitemap.xml` now lists the canonical `/?demo=1` URL used by navigation, README, demo documentation, and metadata. `/demo` remains a supported alias but is not published as canonical.
- `.factory/catalog-description.txt` is a 72-character verb-first sentence.
- `.factory/copy-audit.md` now includes the README; no audited sentence exceeds 22 words or uses unexplained deployment jargon.

## Local and clean-clone verification

The repair was first checked in the working tree, then cloned fresh at commit `0e5f2a1`. The clean clone ran `npm ci` before any test.

- Every one of the 27 commands in `.factory/claims.json` passed separately. Full output: `.factory/qa-artifacts/polish-2-claims-output.txt`.
- `npm test`: 4 Vitest tests, 21 Rust tests, claim-registry validation, and 8 deployment-contract tests passed.
- `npm run check`: TypeScript and clippy passed with warnings denied.
- `npm run build`: produced `dist/`; initial JS is 15.70 KB gzip and CSS is 8.49 KB gzip. The lazy owner-auth chunk is 65.99 KB gzip.
- `npm run test:e2e`: all 25 Playwright tests passed on a complete retry. The first clean-clone run suffered a Chromium process segmentation fault after 18 tests; it was not an assertion failure. The immediate full rerun passed 25/25. Exact output: `.factory/qa-artifacts/polish-2-clean-suite-output.txt`.
- Playwright axe scans found no serious or critical findings across landing, demo, private booking, owner, legal, and 404 states.
- The factory URL verifier passed locally with title, `lang=en`, one h1, main landmark, image alt text, labeled buttons, and no console errors. Evidence: `.factory/qa-artifacts/polish-2-local-verify/verify.json`.
- The local cold-browser audit confirmed zero horizontal overflow, all first-screen facts above the fold, complete route metadata, a metadata-complete true 404, canonical sitemap alignment, demo isolation, and offline demo reload. Evidence: `.factory/qa-artifacts/polish-2-local-audit.json`.

## Deployment and live verification

`npm run deploy` used the work-order wrapper with `WO_DATA_DIR=/data`.

- Azure Container Registry built `sociobotregistry.azurecr.io/sf-guest-booking-confirm:571c44e2ddb2`.
- Container App revision `sf-guest-booking-confirm--0000048` is the sole active revision with one running replica and the fleet-managed `/data` mount.
- `/health` returns the full deployed SHA `571c44e2ddb25bdf6d825a8ce8d5b9b1f1848b1a`.
- Three independent bursts each proved 40 accepted reads then 429, 12 accepted page-view writes then 429, and 12 accepted license checks then 429. Every 429 included `Retry-After: 1`.
- The factory URL verifier passed live with no console errors. Evidence: `.factory/qa-artifacts/polish-2-live-verify/verify.json`.
- Fresh desktop and 390 × 844 contexts found one h1/main per route, no overflow, all facts above the fold, correct route metadata, complete 404 metadata, no console/page errors, and no serious/critical axe findings.
- A fresh live context intercepted only the private booking API response, then verified the shipped production frontend renders a valid booking with private title, description, canonical, OG/Twitter data, and `noindex,nofollow`. Evidence: `.factory/qa-artifacts/polish-2-live-private-booking.png` and `polish-2-live-audit.json`.
- The live demo made no API or cross-origin requests, set no cookies, changed only `demo:guest-booking-confirm:state`, preserved a seeded real key, cleared its sample on exit, and reloaded offline under service-worker control.
- Live Lighthouse mobile: performance 99, accessibility 100, best practices 100, SEO 100, LCP 1.6 s, CLS 0, TBT 30 ms. Raw report: `.factory/qa-artifacts/polish-2-lighthouse-live.json`.

## Run and verify

```sh
npm ci
npm test
npm run check
npm run build
npm run test:e2e
npm run test:billing
```

To run one registered claim, use its exact `test` command from `.factory/claims.json`. The direct sample URL is <https://guest-booking-confirm.sociobot.in/?demo=1>.

## Known gaps and next steps

None.
