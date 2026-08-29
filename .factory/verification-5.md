# Guest Booking Confirm — independent verification 5: **FAIL**

Date: 2026-08-29

Verified candidate: `abe9681e0372c259b60f8382d3f72898e816c090`

Live URL: <https://guest-booking-confirm.sociobot.in>

## Verdict

**FAIL — release blocked.** The live deployment is the exact candidate: `GET /health` returned `{"build_sha":"abe9681e0372c259b60f8382d3f72898e816c090","status":"ok"}`. The historical deployment-only problem is therefore not present. All registered claim tests, local gates, live functional checks, privacy/network checks, service-worker checks, and rate-limit checks passed. The candidate nevertheless fails the mandatory claims and accessibility contracts described below.

## First-read test

Cold-loading `/` in a fresh browser gave this first screen:

- H1: “Request and confirm guest appointments”
- Audience/outcome: “For small businesses that approve times before guests book.”
- First action: “Try it with sample data”, linking directly to `/demo`, with the adjacent explanation “See a guest request, owner approval, and confirmation without saving anything.”

This answers what it does, for whom, and what to click first in plain words. `/demo` immediately displayed the persistent “Demo — sample data, nothing is saved” banner plus Reset demo and Start for real. The supplied sample moved from Ready to confirm to Confirmed and exposed “Download sample calendar (.ics)”. The first-read and one-click-demo requirements pass.

## Release-blocking findings

### P1 — Core advertised features are unlisted, therefore untested claims

`README.md:3` promises that the private link carries status through **rescheduling, cancellation, an ICS calendar file, and the owner's manual reminder checklist**. None of those four visitor-reliant claims has a corresponding entry and exactly one tagged sandbox test in `.factory/claims.json`; the eight registered entries cover demo confirmation/locality, cookies, guest accounts, owner approval, capacities/retention, and API rate limiting only.

The claims contract explicitly requires every reliance claim to be listed and sandbox-tested, and says an unlisted claim fails review until removed or tested. Manual fresh-desk evidence shows reschedule, cancel, and ICS currently work, but that cannot replace the required claim registry and repeatable tagged tests. Add precise claim entries and demo-entry-point tests for reschedule, cancellation, ICS contents/download, and the reminder checklist—or remove the promises. The manual trail was: invalid request `422`; request `201`; initial ICS `409`; owner approval; reschedule; reapproval; confirmation `200`; ICS `200 text/calendar` with `Content-Disposition: attachment; filename=booking.ics`; cancellation `200`; final state `cancelled`.

### P2 — Persistent demo controls fail the 44px touch-target minimum

On both desktop and a 390×844 mobile viewport, fresh `/demo` measured:

| Control | Measured size |
| --- | --- |
| Reset demo | 117.81 × 43.81 CSS px |
| Start for real | 109.72 × 36 CSS px |

The non-negotiable accessibility/design contract requires targets of at least 44×44 CSS px. The cause is visible in `frontend/src/styles.css:67`, which overrides the global `button, .button { min-height: 44px; }` with `.demo-banner .quiet { min-height:36px; }` and `.demo-banner .secondary { min-height:36px; }`. Restore a 44px minimum for both controls and add a regression check at 390px.

## Required claim tests — run first from the clean checkout

All eight entries existed and passed, each through its recorded command:

| Claim ID | Result |
| --- | --- |
| demo-confirmation-trail | PASS — `npm run test:e2e -- --grep @claim:demo-confirmation-trail` |
| demo-local-only | PASS — `npm run test:e2e -- --grep @claim:demo-local-only` |
| no-tracking-cookies | PASS — `npm run test:e2e -- --grep @claim:no-tracking-cookies` |
| guest-no-account | PASS — `npm run test:e2e -- --grep @claim:guest-no-account` |
| owner-approval-before-booking | PASS — `npm run test:e2e -- --grep @claim:owner-approval-before-booking` |
| free-desk-capacity-and-retention | PASS — `cargo test --locked claim_free_desk_capacity_and_retention` |
| panel-pro-capacity-and-retention | PASS — `cargo test --locked claim_panel_pro_capacity_and_retention` |
| api-rate-limit | PASS — `npm run test:e2e -- --grep @claim:api-rate-limit` |

## Local quality and backend verification

- `npm ci` — PASS; 84 packages audited, 0 vulnerabilities.
- `npm test` — PASS; 4 Vitest tests and 10 locked Rust tests, including concurrency, capacity/retention, invalid weekly hours, and the Dockerfile regression.
- `npm run check` — PASS; TypeScript plus `cargo clippy -- -D warnings`.
- `npm run build` — PASS; `dist/` created. Main JS is 36,991 bytes raw / 11,615 bytes gzip; total JS is 12,035 bytes gzip (well below 200 KB) and CSS is 19,918 bytes raw / 5,250 bytes gzip.
- `cargo build --release --locked` — PASS.
- `npm run test:e2e` — PASS; 10 Playwright tests.
- `npm audit --omit=dev` — PASS; 0 vulnerabilities.
- A fresh release binary using a temporary SQLite database passed invalid-input recovery and the normal request/approval/reschedule/reapproval/confirmation/ICS/cancellation trail stated above. The pre-confirmation calendar request correctly returned `409` with a recovery message.
- A release binary started and served `/` and `/health` with only `PORT=4183` set; it defaulted its SQLite location to `/data/guest-booking-confirm.db` and logged generated/defaulted configuration without secrets. `/health` returned build SHA `dev` for the locally compiled binary.
- The source nests every `/api` route behind the same rate-limit middleware. The observed live allowance was 40 GET requests per forwarded client IP per second; request 41 returned `429` and `Retry-After: 1`.

## Live deployment, browser, privacy, and PWA evidence

- Live candidate identity: exact SHA from `/health`, as above.
- Desktop fresh-browser run: no console errors or page errors; one `lang=en`, one `<h1>`, one `<main>`, correct route titles, and zero axe serious/critical findings on `/demo`, `/privacy`, and `/terms`.
- 390px fresh-browser `/demo`: no horizontal overflow (`scrollWidth = clientWidth = 390`), no console errors, and zero axe serious/critical findings.
- Keyboard-only traversal reached the skip link, wordmark, navigation, demo controls, calendar download, build ID, Privacy, and Terms. Reached controls showed the designed `rgb(20, 109, 135) solid 3px` focus outline. The two target-size failures above remain.
- Reduced-motion browser reported `scroll-behavior: auto` and primary-control transition duration `0.00001s`.
- Demo privacy: after confirmation, `document.cookie` was empty and the only local-storage key was `demo:guest-booking-confirm:state`. The complete recorded request set was same-origin: page shell, hashed JS/CSS, `/api/public/settings`, `/demo`, `/privacy`, and `/terms`; no third-party request occurred.
- Service worker: after first visit and reload, the page was controlled; `registration.update()` left active worker `activated` with no waiting/installing worker. `/demo` reloaded offline and showed Ready to confirm.
- Headers: HTML routes served `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, the restrictive CSP (including response-header `frame-ancestors 'none'`), and `Cache-Control: no-cache`. The hashed main asset served `public, max-age=31536000, immutable`. A nonexistent route returned real HTTP 404.

## Next steps

1. Add the missing core claims and exact demo-sandbox tests, or remove the unsupported promises.
2. Make both demo controls at least 44×44 CSS px on desktop and 390px mobile, with a regression test.
3. Rerun independent verification against the newly deployed commit.
