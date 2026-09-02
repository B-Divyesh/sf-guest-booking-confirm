# Independent verification 18 — PASS

Date: 2026-09-02 UTC
Work order: `guest-booking-confirm-verify-18`
Candidate and checked-out commit: `d83724d69b64429b7c14e8b4e049ce82508e865f`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Verdict

**PASS.** The deployed service identifies itself as exactly `d83724d69b64429b7c14e8b4e049ce82508e865f` at `/health`. No release-blocking defect was found in the candidate.

## First-read and demo result

A cold 1440px live browser read the first screen as: “Request and confirm guest appointments” for “microbusinesses that approve time requests” so each guest receives a clear booking status. The first available action is **Try it with sample data**, with the adjacent explanation that it opens Maya’s approved request at the confirmation step. It satisfies what it does, who it is for, and what to click first in plain words.

That action opened the isolated demo in one click. `/demo` and `/?demo=1` rendered the persistent “Demo — sample data, nothing is saved” banner, Reset demo, and Start for real controls. The sample confirmation, reschedule, cancellation, calendar download, and manual-reminder paths are covered by the claim suite.

## Clean-clone gates

`npm ci` completed with no reported dependency vulnerability. All **27** registered `.factory/claims.json` commands were run from this checkout:

- The eight Rust claim commands passed individually.
- The 17 tagged Playwright claim flows were run individually; the complete independent rerun then passed **25/25** browser tests, covering every tagged browser claim.
- `npm run test:billing` passed the live $29 hosted-checkout contract.
- `npm run test:deploy` passed all 8 deployment/release contract tests.

Additional complete gates passed:

- `npm test`: 4 Vitest, 21 Rust, claim-registry validation, and 8 deployment contract tests all passed.
- `npm run check`: TypeScript and `cargo clippy -- -D warnings` passed.
- `npm run build`: produced `dist/`.
- `cargo build --release --locked`: passed; the release binary was built.
- The release binary started with only `PORT=4212` set, selected `sqlite:/data/guest-booking-confirm.db`, served `/health`, and exited cleanly on SIGTERM.

The Docker CLI is not installed in this verification container, so an actual Docker image build could not be performed. The production Rust release build, container-contract claim, and no-extra-environment runtime check above passed.

## Live behavior, privacy, and backend checks

- `/health` returned `200 {"build_sha":"d83724d69b64429b7c14e8b4e049ce82508e865f","status":"ok"}`.
- A fresh live demo browser made requests only to `https://guest-booking-confirm.sociobot.in`, made no API request, created only `demo:guest-booking-confirm:state`, and had no cookies. Confirming the sample remained local. A separate cold landing check observed the expected real-desk settings read only.
- Offline reload after service-worker installation retained the ready-to-confirm demo and its Confirm action. The live `sw.js` used cache `gbc-shell-v5`; a stale cache inserted in a disposable context was removed after unregister / re-register activation, leaving only `gbc-shell-v5`.
- Live rate evidence with one forwarded client: **40** read `200` responses followed by one `429 Retry-After: 1`; **12** page-view write `204` responses followed by one `429 Retry-After: 1`. `/health` remained available.
- Rust tests cover concurrent confirmation and owner approval, the free-cap race, retention, SQLite storage inventory, and first-owner exclusivity.
- The live private-link negative case exposed no booking details and correctly used `Private booking — Guest Booking Confirm`, a private canonical URL, and `noindex,nofollow`.

## Accessibility, headers, mobile, and performance

- Fresh live 390x844 demo: no console/page errors; visible teal 3px skip-link focus; Skip to main moved keyboard focus to `<main>`; reduced motion changed scrolling to `auto`; Axe found zero serious/critical violations.
- The complete local Playwright suite also covers desktop, 390px layout, 200% text resize, keyboard operation, reduced motion, form recovery, private-link security, and Axe scans.
- Live HTML has `lang=en`, a descriptive title, one h1, one main landmark, canonical/OG metadata and a CSP. Headers include `nosniff`, `DENY`, `Referrer-Policy: same-origin`, restrictive Permissions-Policy, and CSP `frame-ancestors 'none'`. Hashed main JS is cached `public, max-age=31536000, immutable`.
- Initial JS is 15.70 KB gzip plus 0.40 KB bootstrap; CSS is 8.49 KB gzip. The auth chunk is lazy (65.99 KB gzip). All meet the first-load budget.
- Fresh live mobile Lighthouse: Performance 90, Accessibility 100, Best Practices 100, SEO 100; FCP 1.3s, LCP 1.5s, CLS 0, TBT 410ms.

## Defects

None found. Severity counts: blocker 0, critical 0, major 0, minor 0.
