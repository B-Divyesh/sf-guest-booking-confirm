# Guest Booking Confirm — independent verification: **FAIL**

Date: 2026-08-29

Work order: `guest-booking-confirm-verify-9`

Candidate: `46a644d323f0f98aed9edb73d540613c4e0b5934`

Live URL: <https://guest-booking-confirm.sociobot.in>

Acceptance contract: `.factory/brief.json`, the supplied work order, and attached factory skills

## Decision

**FAIL — do not release this candidate.** The earlier deployment-only billing
failure is fixed: the live $29 Panel Pro checkout claim passes. The candidate is
also deployed exactly, and the core booking/demo workflows are sound. Fresh QA
found three release blockers:

1. One mandatory claim command failed on its first clean installed run.
2. Visitor-facing privacy and licensing promises are absent from
   `.factory/claims.json`.
3. The keyboard focus ring is below the required 3:1 contrast on two dark
   product surfaces.

There are no P0 findings.

## Release-blocking findings

### P1 — a mandatory claim test times out from the clean checkout

After confirming a clean worktree at the candidate and running `npm ci`, the
first exact command in `.factory/claims.json` failed:

```text
npm run test:e2e -- --grep @claim:demo-confirmation-trail
Error: Timed out waiting 120000ms from config.webServer.
```

The Playwright web-server command performs a cold `cargo run`. Downloading and
compiling the Rust graph exceeded the configured 120-second server timeout.
The compile completed during the next claim, and the exact command passed on a
warm rerun in 8.3 seconds. That rerun confirms the behavior, but it does not
erase the required clean-run failure: the acceptance contract says any failing
claim test is release-blocking.

Suggested correction: make the documented clean claim command reliably start
the server, for example by allowing the cold Rust build enough time or by
making an explicit backend build part of the test harness.

### P1 — the claims registry is incomplete

The live copy and README were cross-checked against all 15 registered claims.
At least these visitor-reliable promises have no matching claim entry and
sandbox test:

- `/privacy`: “The service also stores a daily page-view count with no cookie,
  fingerprint, or IP address attached.” The registered `no-tracking-cookies`
  test runs `/demo`, which intentionally makes no page-view request; it cannot
  prove what the real endpoint stores.
- `/privacy`: “We do not sell data or use it for advertising.” This is not in
  the registry. Under the claims contract, an untestable marketing/privacy
  promise must be removed rather than left unproved.
- `/privacy`: sign-in state stays in session storage, and the license plus last
  verification result stay in local storage without delaying the free first
  paint. Existing unregistered Playwright coverage proves only part of this.
- `/terms`: a refunded or revoked license returns the calendar to free limits
  without deleting accessibility or export features. No registered sandbox
  test exercises a formerly valid license becoming revoked.
- Site footer: “Original generated artwork.” Provenance exists in
  `.factory/design.md`, but the public claim is not registered or tested.

The claims skill explicitly makes any unlisted claim a failing review. Add
observable tests and registry entries, or remove/qualify the copy.

### P1 — focus indicator contrast is below the accessibility baseline

The global focus style is a 3px `#146D87` outline. It is geometrically visible,
but its contrast against product dark surfaces is insufficient:

- Live `/demo`, `Reset demo` and `Start for real`: outline `rgb(20,109,135)`
  against banner `rgb(49,88,76)` = **1.36:1**.
- Configured booking hero, `Try it with sample data`: the same outline against
  panel `rgb(32,42,40)` = **2.51:1**.

The supplied accessibility contract requires at least 3:1. Axe reports zero
serious/critical findings because it does not evaluate this focus-indicator
contrast. Use a contrasting focus token or a two-color indicator on dark
surfaces.

## Cold first-read gate — PASS

The fresh 1440 × 900 first viewport answers all three required questions:

- What: **“Request and confirm guest appointments.”**
- For whom: **“For small businesses that approve times before guests book.”**
- First action: **“Try it with sample data.”** Adjacent text says it shows a
  guest request, owner approval, and confirmation without saving anything.

The action is above the fold and opens `/demo` in one click. The destination
immediately shows Maya Chen’s approved appointment and a persistent “Demo —
sample data, nothing is saved” banner with Reset demo and Start for real.

## Mandatory claims gate — FAIL (14/15 first-run passes)

`.factory/claims.json` exists. Every listed command was executed independently
after `npm ci` from the clean candidate checkout.

| Claim | First-run result | Evidence |
| --- | --- | --- |
| `demo-confirmation-trail` | **FAIL** | Playwright server timed out after 120,000 ms during cold Rust compile; warm rerun passed 1/1 in 8.3 s |
| `demo-local-only` | PASS | 1/1 Playwright test |
| `no-tracking-cookies` | PASS | 1/1 Playwright test |
| `guest-no-account` | PASS | 1/1 Playwright test |
| `owner-approval-before-booking` | PASS | 1/1 Playwright test |
| `guest-rescheduling` | PASS | 1/1 Playwright test |
| `guest-cancellation` | PASS | 1/1 Playwright test |
| `confirmed-calendar-ics` | PASS | 1/1 Playwright test |
| `manual-reminder-checklist` | PASS | 1/1 Playwright test |
| `free-desk-capacity-and-retention` | PASS | 1/1 locked Rust test |
| `panel-pro-capacity-and-retention` | PASS | 1/1 locked Rust test |
| `panel-pro-checkout` | PASS | live catalog, 303 checkout redirect, and hosted Dodo page test |
| `api-rate-limit` | PASS | 1/1 Playwright test; three 41-request repetitions |
| `owner-entra-identity` | PASS | 1/1 Playwright test |
| `container-runtime-contract` | PASS | 1/1 locked Rust test |

## Local quality gates

- `npm ci` — PASS: 85 packages installed, 86 audited, 0 vulnerabilities.
- `npm test` — PASS: 4 Vitest tests and 17 Rust tests.
- `npm run check` — PASS: TypeScript and Clippy with warnings denied.
- `cargo fmt --all -- --check` — PASS.
- `cargo build --release --locked` — PASS.
- `npm run build` — PASS; `dist/` produced.
- `npm audit --omit=dev` — PASS: 0 vulnerabilities.
- `npm run test:e2e` — PASS: 20/20 Playwright tests.

The full suite covers the normal guest request → owner approval → guest
confirmation flow, rescheduling, cancellation, calendar export, manual reminder
state, owner identity, errors, keyboard use, responsive behavior, axe, service
worker behavior, and rate limiting.

## Independent backend exercise

A release binary was started against a new temporary SQLite database and
exercised outside the repository tests:

- Owner setup: 201.
- One-character name / invalid email: 422 with recovery text.
- Missing consent: 422 with recovery text.
- 31-day slot boundary: 1,430 valid half-hour slots for the deliberately broad
  test schedule.
- Guest request: 201; owner approval: 200; guest confirmation: 200.
- Reusing the single-use confirmation action: 409.
- ICS: 200, `text/calendar`, attachment filename, `VCALENDAR`, and
  `STATUS:CONFIRMED`.
- Invalid private token: 404.
- After SIGTERM and restart on the same database, the booking remained
  `confirmed` and returned 200.

Rust tests additionally proved one-winner behavior for concurrent approval and
confirmation, atomic free-capacity enforcement, retention boundaries, owner
isolation, and rolling-window rate-limit behavior.

DST checks with `America/New_York` returned no nonexistent 02:00 slots on
2027-03-14 and no ambiguous 01:00 slots on 2026-11-01; offsets changed correctly
from `-05:00` to `-04:00` and back.

The release binary also started with only `PORT=4180`, used
`sqlite:/data/guest-booking-confirm.db`, returned health 200, logged the required
Sociobot Entra authority, and exited cleanly on SIGTERM. Docker is not installed
in this worker, so an independent local image build/run was unavailable. The
static container contract test passed, and the deployed container was checked
directly.

## Live deployment and backend limits

- `/health` returns build SHA
  `46a644d323f0f98aed9edb73d540613c4e0b5934`.
- SHA-256 matches between fresh local `dist/` and live for `index.html`, all
  JS/CSS chunks, favicon/touch icon, hero WebP/fallback, and social image.
- Three independent live 41-request read bursts each returned exactly **40 ×
  200 + 1 × 429**, with `Retry-After: 1`.
- A 13-request write burst returned exactly **12 × 204 + 1 × 429**, also with
  `Retry-After: 1`.
- Observed allowances: 40 reads and 12 writes per client in a rolling one-second
  window. `/health` is exempt.
- A separate 100-request burst using 100 client identities returned 100 × 200
  in 1.064 s (p95 663 ms).
- `/manage` shows no password field and initiates discovery only at
  `https://sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650/...`.
- The live `$29` Panel Pro catalog/checkout test passes, including the 303 to a
  Dodo hosted session and a 200 hosted page. No purchase was made.

## Privacy, security headers, routing, and caching

A fresh live `/demo` confirmation emitted only four same-origin GETs (document,
main JS, helper JS, CSS), no API/action request, no failed response, and no
console/page error. It set no cookies and wrote only:

```text
demo:guest-booking-confirm:state = {"status":"confirmed"}
```

The live document sends CSP with `frame-ancestors 'none'`, `X-Frame-Options:
DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, and a
camera/microphone/geolocation-denying Permissions Policy. Shell routes and
`/sw.js` use `Cache-Control: no-cache`; hashed assets use one-year immutable
caching. `robots.txt` and `sitemap.xml` return 200. An unknown route returns the
designed HTML with status 404. All rendered internal links crawled from the
landing, demo, privacy, terms, and owner pages returned 200.

## Accessibility, mobile, PWA, and performance

- `/opt/fleet/lib/verify-url.sh` — PASS on live `/` and `/demo`: title, `lang`,
  one `h1`, main landmark, alt text, labeled buttons, and no console errors.
- Axe 4.10.2 — zero serious/critical findings on `/`, `/demo`, `/privacy`, and
  `/terms` at 1440 × 900 and 390 × 844.
- At both sizes, all four routes have one `h1`, one `main`, `lang=en`, no
  horizontal overflow, and no console/page errors.
- At 390 px with root text set to 200%, `/`, `/demo`, `/privacy`, `/terms`, and
  `/manage` had no horizontal overflow or overlapping interactive controls.
- All visible interactive targets measured at least 44 × 44 CSS px.
- Keyboard traversal reaches every live demo action. The skip link is first,
  and Enter moves focus to `main`. The contrast defect above remains.
- With reduced motion, `scroll-behavior` is `auto` and animation/transition
  duration is effectively zero.
- The service worker activated, controlled the reload, completed `update()`
  with no waiting worker, excluded `/auth/callback`, and reloaded `/demo`
  successfully offline.
- Lighthouse mobile: performance **98**, accessibility **100**, best practices
  **100**, SEO **100**; FCP 1.3 s, LCP 1.5 s, TBT 170 ms, CLS 0.
- Initial JS is 42,445 B + 711 B raw (13,088 B + 420 B gzip); CSS is 20,339 B
  raw / 5,330 B gzip. The owner-only auth chunk is lazy-loaded (65,679 B gzip).
  Hero WebP is 41,526 B. All are within budget.

## Required next steps

1. Make every exact claim command pass on its first clean installed run.
2. Register and test every public privacy/licensing/provenance claim, or remove
   claims that cannot be proved in the sandbox.
3. Raise focus-indicator contrast to at least 3:1 on the demo banner and dark
   configured hero, then repeat keyboard and contrast checks.
4. Re-run this complete verification from a fresh checkout.
