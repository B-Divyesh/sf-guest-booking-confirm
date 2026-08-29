# Guest Booking Confirm — independent re-verification: **FAIL**

Date: 2026-08-29
Work order: `guest-booking-confirm-verify-6`
Candidate: `7aa1a7ebefabfb0adf485103487367676f916c6b`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Decision

**FAIL — do not release.** The live `/health` response identifies itself as
`7aa1a7ebefabfb0adf485103487367676f916c6b`. The supplied checkout was at
`b831988…`, but its only differences from the candidate are verification and
handoff documents; frontend, backend, build files, and the produced assets are
identical. SHA-256 values for the live main JS and CSS exactly matched the
fresh local production build.

All declared claim commands and local quality gates passed. That does not
override the release blockers independently reproduced below.

## Cold first-read result

**PASS.** In a new browser context, the first live screen plainly says:

- It does: “Request and confirm guest appointments.”
- It is for: “small businesses that approve times before guests book.”
- First action: **Try it with sample data**; its adjacent sentence explains
  that it shows a guest request, owner approval, and confirmation without
  saving anything.

The action is on the first screen at 1440 px and 390 px. It opens `/demo`,
which immediately shows Maya Chen’s approved sample, the persistent “Demo —
sample data, nothing is saved” banner, **Reset demo**, and **Start for real**.

## Mandatory claims — run first

`.factory/claims.json` exists. After `npm ci` (84 packages audited; zero
vulnerabilities), every exact command listed there was run separately from the
clean checkout:

| Claim | Result |
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
| `api-rate-limit` | PASS — 1 Playwright test |

## Release-blocking findings

### P1 — free capacity is not atomic

The product claims that a free desk allows 30 active future bookings. On a
fresh, release-built SQLite desk, I created 29 valid requests and then sent 12
valid requests for distinct available times concurrently, each with a distinct
client identity. The exact result was:

```json
{
  "seedStatuses": [201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201, 201],
  "raceStatuses": [201, 201, 201, 201, 409, 201, 409, 409, 409, 409, 409, 409],
  "activeFinal": 34
}
```

The count at `src/main.rs:457` is checked before the independent insert at
`src/main.rs:499`. Use one transaction/conditional write for the count and
insert, and make the registered capacity claim test exercise concurrent
clients. The current tagged claim test checks only sequential creation.

### P1 — owner authentication violates the required identity provider

The owner workflow requires an account-like sign-in but uses a locally created
Argon2 password and `/api/owner/login`. Live `/manage` presents an **Owner
password** field; the checked production source contains no
`sociobotcustomers.ciamlogin.com`, Microsoft Entra, OAuth, or OIDC integration.
The acceptance contract requires the Sociobot Microsoft Entra External ID
tenant for any product that requires sign-in. Guest accountlessness does not
remove this owner-authentication requirement.

### P1 — the mobile owner setup cannot be used reliably

At a 390 × 844 viewport, each seven-day closing-time control on live `/manage`
measured **18 × 44 CSS px** (for example, Monday `17:00` at x=242.05), while
the corresponding opening control was 102.09 × 44 px. The closing value is
rendered as a narrow blank strip and is below the required 44 px touch-target
width. The cause is the mobile rule
`grid-template-columns: 1fr 1fr 18px 1fr` in `frontend/src/styles.css:207`.
This prevents a mobile-first real owner from setting the booking hours.

### P1 — live multi-instance rate limiting does not honor the claimed 41st-request allowance

The registered claim says that 41 same-client GETs end in `429` with
`Retry-After: 1`; the local claim test passes. Fresh production checks did not
match it: 41 concurrent live `GET /api/public/settings` requests from one
client returned **41 × 200**, and 50 then 100 concurrent requests also returned
only 200. At 200 concurrent requests, the result was **120 × 200 and 80 × 429**;
the 429 responses had `Retry-After: 1`.

Thus the live deployment permits roughly 120 requests per client/window,
consistent with an in-process limiter divided across three instances, rather
than the documented 40. Enforce the intended allowance across active instances
or correct the claim and deployment contract; as deployed, the candidate does
not provide the claimed 41st-request behavior.

### P1 — claims contract is incomplete

- README and the Privacy page describe private booking links as “unguessable”;
  this reliance claim has no entry or tagged observable test in
  `.factory/claims.json`.
- README claims that the container runs as UID 10001, persists SQLite at
  `/data`, and shuts down gracefully; these are also absent from the claim
  registry.
- The `manual-reminder-checklist` claim promises that a reminder can be
  recorded “without the product sending a message,” but its tagged test only
  checks displayed state and persistence. It does not record outgoing requests
  or otherwise assert the no-message portion.

The claims contract requires every visitor-reliance claim to have one matching
observable sandbox test (or the copy must be removed).

## Other defects

### P2 — primary-action explanation overlaps its action

On the cold landing screen at both desktop and 390 px, the note below **Try it
with sample data** overlaps the action by 14 CSS px: desktop button bottom
577.47/note top 563.47; mobile button bottom 549.42/note top 535.42. The cause
is the negative `.button-note` margin. The words remain discernible, but the
required explanation is partially obscured.

### P2 — 200% text test has horizontal overflow

At 390 px after setting the root text size to 200%, live root measured
`scrollWidth: 459` and `clientWidth: 390`. This violates the required mobile
reflow baseline even though normal-size views have no overflow.

### P3 — stated character validation counts UTF-8 bytes

The API message says a name must be 2–80 “characters,” but
`validate_name_email` uses Rust `String::len()`. On a fresh local release desk,
one ASCII character (`A`) correctly received 422, while the one-character CJK
name `李` received 201 because it occupies three UTF-8 bytes. Count Unicode
characters/graphemes or state a byte limit.

## Successful verification evidence

- `npm test` passed: 4 Vitest and 11 Rust tests.
- `npm run check` passed: TypeScript plus clippy with warnings denied.
- `cargo fmt --check`, `cargo build --release --locked`, `npm run build`, and
  `npm audit --omit=dev` passed. `dist/` was produced.
- `npm run test:e2e` passed: 16 Playwright tests.
- Production assets: 40,633 B main JS (12,320 B gzip), 711 B additional JS
  (400 B gzip), and 20,185 B CSS (5,280 B gzip), well below the stated budgets.
- A fresh local normal flow returned 422 recovery messages for invalid setup,
  bad email, and missing consent; a valid request returned 201, owner approval
  200, guest confirmation 200, repeat confirmation 409, and ICS 200 with
  `text/calendar`, attachment disposition, `VCALENDAR`, and `STATUS:CONFIRMED`.
- Fresh live `/`, `/demo`, `/privacy`, `/terms`, and `/manage` checks at desktop
  and 390 px had one `h1`, one `main`, `lang=en`, no console/page errors, and
  zero axe serious/critical findings. Keyboard traversal reached the skip link
  and all demo controls with the designed `rgb(20, 109, 135) solid 3px` ring.
- A reduced-motion context reported `scroll-behavior: auto` and 0.01 ms motion.
- A live demo confirmation/reschedule/reset trace made only same-origin shell
  and asset requests, set no cookies, wrote only
  `demo:guest-booking-confirm:state`, and made no API request. The service
  worker was active after update; a controlled `/demo` reload worked offline.
- `/opt/fleet/lib/verify-url.sh` passed live root and `/demo`. Headers include
  `nosniff`, `DENY` framing, same-origin referrer policy, CSP with response
  `frame-ancestors 'none'`, and permissions policy. HTML is `no-cache`; hashed
  assets are `public, max-age=31536000, immutable`; an unknown route returns
  real HTTP 404. `robots.txt` and `sitemap.xml` returned 200.

## Required repair and re-verification

1. Make free-capacity creation atomic and add a concurrent registered claim.
2. Replace local owner passwords with Sociobot Entra External ID, or obtain a
   written exception to the acceptance contract.
3. Fix and test the 390 px hours editor so every input is readable and at least
   44 × 44 px.
4. Make production rate limiting a single-client, deployment-wide allowance
   that matches the documented claim and returns `Retry-After` immediately
   after it.
5. Complete the claims registry/tests, then repair the overlap, text reflow,
   and Unicode character-count defects.
