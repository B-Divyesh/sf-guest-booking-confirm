# Guest Booking Confirm — independent verification 6: **FAIL**

Date: 2026-08-29

Work order: `guest-booking-confirm-verify-6`

Verified candidate: `7aa1a7ebefabfb0adf485103487367676f916c6b`

Live URL: <https://guest-booking-confirm.sociobot.in>

## Verdict

**FAIL — do not release this candidate.** The live deployment is the exact requested candidate, every declared claim command passes, and the demo, build, privacy, PWA, rate-limit, and baseline accessibility checks are healthy. Fresh independent checks nevertheless found three release-blocking product defects and an incomplete claims contract:

1. The advertised 30-active-booking free limit is not atomic. Starting from 29 active bookings, 12 concurrent requests from distinct clients produced three successful creations and left 32 active bookings.
2. The owner panel requires its own local password sign-in. It does not use the required Sociobot Microsoft Entra External ID authority `sociobotcustomers.ciamlogin.com`.
3. At 390 px, every closing-time input in owner setup is only 18 × 44 CSS px and appears as an unreadable blank strip, so the real setup workflow is not mobile-usable and misses the 44 × 44 target minimum.
4. README/privacy reliance claims remain outside `.factory/claims.json`, and the manual-reminder test does not test the “without sending a message” part of its registered claim.

No product code was modified during verification.

## Required first-read test

**PASS.** A cold, fresh-context live load showed:

- Job: **Request and confirm guest appointments**.
- User: **For small businesses that approve times before guests book.**
- First action: **Try it with sample data**, linking directly to `/demo`.

The action is above the fold on desktop and 390 px mobile. `/demo` opens an owner-approved Maya Chen sample in one click and shows the persistent **Demo — sample data, nothing is saved** banner with **Reset demo** and **Start for real**.

There is a separate visual defect: the explanation beneath the primary action overlaps the button by exactly 14 CSS px at both 390 × 844 and 1440 × 900. The three mandatory first-read facts remain readable, but “See a guest request…” is partly obscured. Evidence: `qa-artifacts/verification-6/live-first-read-desktop.png` and `qa-artifacts/verification-6/verify-live-root/screenshot-mobile.png`.

## Required claim tests — run first from the clean checkout

The initial tree was clean and `git rev-parse HEAD` was the requested SHA. `npm ci` installed 83 packages with zero reported vulnerabilities. `.factory/claims.json` exists. Every listed command was then run individually against its specified demo/test entry point before broader inspection:

| Claim ID | Result |
| --- | --- |
| `demo-confirmation-trail` | PASS — 1 Playwright test |
| `demo-local-only` | PASS — 1 Playwright test |
| `no-tracking-cookies` | PASS — 1 Playwright test |
| `guest-no-account` | PASS — 1 Playwright test |
| `owner-approval-before-booking` | PASS — 1 Playwright test |
| `guest-rescheduling` | PASS — 1 Playwright test |
| `guest-cancellation` | PASS — 1 Playwright test |
| `confirmed-calendar-ics` | PASS — 1 Playwright test |
| `manual-reminder-checklist` | PASS — 1 Playwright test |
| `free-desk-capacity-and-retention` | PASS — 1 locked Rust test |
| `panel-pro-capacity-and-retention` | PASS — 1 locked Rust test |
| `api-rate-limit` | PASS — 1 Playwright test; request 41 receives 429 with `Retry-After: 1` |

Passing the declared tests does not override the live defects below. In particular, the free-cap test is sequential and does not detect the reproduced concurrent overrun.

## Release-blocking findings

### P1 — concurrent requests exceed the claimed free capacity

The product claims: “The free desk allows 30 active future bookings.” On a fresh release binary and SQLite desk, I created 29 active future requests and then sent 12 simultaneous valid booking requests, each from a different `X-Forwarded-For` client and using a distinct available slot.

Observed:

```json
{
  "activeAtRace": 29,
  "raceStatuses": [201, 201, 409, 201, 409, 409, 409, 409, 409, 409, 409, 409],
  "activeFinal": 32
}
```

The check and insert are separate operations in `src/main.rs:459` and `src/main.rs:499`. Multiple requests can observe 29 before any inserts commit. Enforce capacity in the same transaction/write condition and add a multi-client concurrency regression to the claim test. The current claim test proves only sequential request 31 is rejected.

### P1 — owner sign-in does not use the required Entra tenant

The owner workflow requires authentication: `/manage` creates an Argon2 password, `/api/owner/login` verifies it, and the UI presents **Sign in**. The repository and live request trail contain no Microsoft Entra integration and no `sociobotcustomers.ciamlogin.com` authority. This fails the work-order requirement that any product requiring sign-in use that Sociobot Microsoft Entra External ID tenant and nothing else.

Guest booking correctly requires no account; this finding applies to the authenticated owner panel.

### P1 — owner setup is not usable at 390 px

Fresh live `/manage` at 390 × 844 renders all seven closing-time inputs as 18 × 44 CSS px blank strips. Their current values are not readable, and the targets are narrower than the mandatory 44 px minimum. Screenshot: `qa-artifacts/verification-6/live-manage-mobile.png`.

The mobile grid at `frontend/src/styles.css:207` declares `grid-template-columns: 1fr 1fr 18px 1fr`. Because the day toggle spans the row, the opening input occupies column 1, “to” occupies column 2, and the closing input lands in the fixed 18 px column 3. The product's real first-run setup therefore fails mobile and touch use even though Playwright can fill the field by accessible name.

### P1 — claims contract is still incomplete

- README and the live Privacy page say the private booking link is **unguessable**. This security claim has no `.factory/claims.json` entry or tagged test.
- README additionally claims the container runs as UID 10001, persists SQLite at `/data`, and shuts down gracefully. These observable operational claims are unlisted.
- The registered `manual-reminder-checklist` claim says the product records a reminder **without sending a message**, but its tagged test at `tests/booking-flow.spec.ts:116` checks only the displayed/persisted state. It records no requests and cannot detect a message/API call. A separate manual live trace found no request, but the mandatory claim test itself does not prove the full claim.

The supplied claims contract says an unlisted reliance claim fails review until removed or given one observable sandbox test.

## Other findings

### P2 — first-screen action note overlaps its button

The `.button-note` rule at `frontend/src/styles.css:109` applies `margin-top: -14px`. On the unconfigured landing page, the note follows an inline anchor rather than a full-width form button, producing a measured 14 px overlap at both desktop and mobile. The primary action itself remains readable, so the strict first-read gate passes, but the explanation of what happens next is partly obscured.

### P2 — 200% text resize introduces horizontal overflow

At 390 px with the root text size doubled, the page grows to 436 px wide. The decorative `.big-lamp` extends to x = 435.86 px. Text and actions remain present, but the page now scrolls horizontally, contrary to the mobile reflow baseline. Evidence: `qa-artifacts/verification-6/live-demo-mobile-text-200.png`.

### P3 — “characters” validation counts UTF-8 bytes

The API reports a 2–80-character name rule, but `validate_name_email` uses Rust byte length. A one-character CJK name (`李`, three UTF-8 bytes) was accepted with HTTP 201 while the one-character ASCII name was rejected with HTTP 422. Longer non-ASCII names can likewise be rejected before 80 characters. Count Unicode characters or describe a byte limit accurately.

## Local quality gates

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 83 packages installed; 0 vulnerabilities |
| `npm test` | PASS — 4 Vitest + 11 Rust tests |
| `npm run check` | PASS — TypeScript and clippy with warnings denied |
| `cargo fmt --check` | PASS |
| `npm run build` | PASS — `dist/` produced |
| `npm run test:e2e` | PASS — 16 Playwright tests |
| `cargo build --release --locked` | PASS |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |

Production frontend sizes:

- JavaScript: 40,633 + 711 bytes raw; 12,727 bytes gzip total.
- CSS: 20,185 bytes raw; 5,287 bytes gzip.
- Hero WebP: 41,526 bytes.
- Social card: 94,723 bytes, 1200 × 630.

These are well inside the supplied budgets. Docker is unavailable in this verifier image, so the container could not be rebuilt locally. The locked release binary did start with only `PORT=4183`, created its default `/data/guest-booking-confirm.db`, served `/health`, and shut down cleanly on SIGINT. The verifier-created database and temporary test directory were then removed. The multi-stage Dockerfile uses `rust:1-slim`, has `ARG BUILD_SHA=dev`, runs as UID 10001, and does not depend on `.git`.

## Functional, boundary, persistence, and concurrency evidence

On a fresh local release server:

- Invalid business name, timezone, duration below 15/above 480, inverted hours, and short password returned 422 with recovery text; valid setup returned 201.
- Invalid guest name, email, missing consent, 31-character phone, malformed time, too-soon time, more-than-one-year time, and unavailable time returned 422/409 with specific recovery text.
- Two requests for the same available slot were created; concurrent owner approvals returned exactly 200 and 409.
- Concurrent use of one approved confirmation link returned exactly 200 and 409.
- The confirmed ICS returned `text/calendar`, `attachment; filename=booking.ics`, and contained VCALENDAR, summary, confirmed status, DTSTART, and DTEND.
- Reminder, reschedule, required reapproval, reconfirmation, cancellation, and repeat-cancellation conflict all behaved correctly.
- Restarting the server against the same SQLite file preserved the cancelled booking and settings.
- New York spring-forward slots on 2027-03-14 were 01:00, 01:30, 03:00, and 03:30 with correct offsets; nonexistent 02:xx times were absent. Ambiguous fall-back 01:xx slots were conservatively omitted.
- A 100-request concurrent public-settings smoke from distinct clients returned 100 × 200.
- Local GET allowance: 40 per client per second, then 429 with `Retry-After: 1`.
- Local write allowance: 12 per client per second, then 429 with `Retry-After: 1`.
- `/health` remained exempt and returned 100 × 200 under the load smoke.

## Live deployment, privacy, accessibility, PWA, and headers

- **Build identity:** live `/health` returns `7aa1a7ebefabfb0adf485103487367676f916c6b`. SHA-256 hashes of all three live hashed JS/CSS files exactly match local `dist/`.
- **Live rate limit:** 41 concurrent GETs from one fresh forwarded client produced 40 × 200 and 1 × 429 with `Retry-After: 1`; 45 health requests still returned 200. Observed allowance: **40 GET requests per client per one-second window**.
- **Privacy:** a fresh complete demo confirmation/reschedule/cancel/reminder trace made only same-origin shell/asset requests, made no `/api` request, set no cookie, and wrote only `demo:guest-booking-confirm:state`. The reminder state survived reload. Root's page view is same-origin.
- **Accessibility:** Playwright axe found zero serious/critical violations on `/`, `/demo`, `/privacy`, `/terms`, and `/manage`. Each has `lang=en`, exactly one h1, one main landmark, and no image missing alt text. Keyboard traversal reaches the skip link and all demo controls; reached controls show a 3 px `rgb(20, 109, 135)` focus outline. The mobile closing-time defect above remains.
- **Responsive:** normal 390 px `/demo` has `scrollWidth = clientWidth = 390`, 16 px body text, and both persistent demo controls are 48 px tall. The owner setup exception and 200%-resize issue are documented above.
- **Reduced motion:** the reduced-motion context matched and computed `scroll-behavior: auto`, with transition/animation duration reduced to 0.01 ms.
- **PWA:** the live worker is active/activated with no waiting or installing worker after `registration.update()`. After an online controlled reload, `/demo` reloaded offline and retained its confirmed state.
- **Console:** no console errors, uncaught page errors, or unexpected failing responses occurred in the audited routes and demo flows.
- **Headers/cache:** HTML has `nosniff`, `DENY` framing, `same-origin` referrer policy, restrictive CSP with response-header `frame-ancestors 'none'`, permissions policy, and `Cache-Control: no-cache`. Hashed assets use `public, max-age=31536000, immutable`. Unknown routes return real HTTP 404. `robots.txt`, `sitemap.xml`, privacy, terms, favicon, and social card return 200.
- **Metadata:** title length 48, description length 90, canonical/OG/Twitter fields are present, and the social image is 1200 × 630.
- **Lighthouse mobile:** root — Performance 98, Accessibility 100, Best Practices 100, SEO 100, LCP 1.4 s, CLS 0, TBT 160 ms. Demo — Performance 99, Accessibility 100, Best Practices 100, SEO 92, LCP 1.3 s, CLS 0, TBT 140 ms. Reports are under `qa-artifacts/verification-6/`.
- **Factory verifier:** `/opt/fleet/lib/verify-url.sh` passes the live root and `/demo`; evidence is under `qa-artifacts/verification-6/verify-live-*`.

## Required repair and re-verification

1. Make free-cap enforcement atomic and add a multi-client concurrent claim regression that proves active bookings never exceed 30.
2. Replace local owner-password authentication with the mandated Sociobot Entra External ID authority, or obtain an explicit contract exception.
3. Repair and regression-test the entire owner-hours grid at 390 px, including readable 44 px-wide opening and closing controls.
4. Register every remaining README/privacy reliance claim and make the reminder claim test observe that no message/network request occurs.
5. Remove the landing note overlap and the 200%-resize horizontal overflow; use Unicode character counts for stated character limits.
