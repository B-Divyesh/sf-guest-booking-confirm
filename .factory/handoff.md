# Guest Booking Confirm — adversarial review 2 handoff

Date: 2026-09-02 UTC
Work order: `guest-booking-confirm-review-2`
Reviewed repository: `638543d921233300df1d487f61daed047a5e6a44`
Live build: `10ad42f4b0e5b580488b00272c0462c4e6b90e79`

## Outcome

**FAIL — four findings remain.**

The complete report is `.factory/review-2.md`. F-1-7 is blocking because valid private booking pages receive 404 metadata. F-1-30 is a blocking README jargon/length regression. F-2-1 records unlisted deployment claims, and F-2-2 records a sitemap/canonical mismatch.

No product code was changed.

## Verification completed

From a clean clone at `/tmp/gbc-review-2-vI16b1`:

```sh
npm ci
npm test
npm run check
npm run build
npm run test:e2e
```

All passed. Each of the 26 claim commands in `.factory/claims.json` also passed separately. The build produced `dist/`; the initial JavaScript is 16.04 KB gzip and the lazy owner-auth chunk is 65.99 KB gzip.

Live verification covered fresh 390 × 844 and 1440 × 900 first reads, one-click demo entry, confirm/reset/exit, storage isolation, offline reload, cookie and request logs, route metadata, true 404 behavior, link status, h1 focus on navigation and Back, the factory URL verifier, and axe scans. A clean local valid-booking probe reproduced F-1-7. The demo made no API or cross-origin request before exit and did not alter a seeded real-storage key. Axe found no serious or critical violations.

## Next steps

1. Resolve F-1-7 with private-booking metadata and a browser regression.
2. Resolve F-1-30 with the exact short rewrite in the review.
3. Remove the deployment promises or register and test them as described in F-2-1.
4. Align the sitemap and demo canonical per F-2-2.
5. Rerun the README copy, route, and claims checks.
