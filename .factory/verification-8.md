# Guest Booking Confirm — independent verification: **FAIL**

Date: 2026-08-29
Work order: `guest-booking-confirm-verify-7`
Candidate and live build: `62ad93dbe42f385d65312a371cdfa7d76370acd0`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Decision

**FAIL — do not release.** The live service violates its registered and
documented rate-limit promise, which is mandatory for every server-side
endpoint. A complete local Playwright run also failed the tagged claim for the
same limit. The deployment itself is current: `/health` returned the supplied
candidate SHA and all four fetched production asset SHA-256 values matched the
fresh local production build.

## Cold first read

**PASS.** In a fresh unauthenticated context, the first screen says what it
does: “Request and confirm guest appointments”; who it is for: “small
businesses that approve times before guests book”; and what to do first:
**Try it with sample data**. The adjacent sentence explains that it will show
a guest request, owner approval, and confirmation without saving anything.
The visible link opens `/demo` in one click.

## Mandatory claims, run first

`.factory/claims.json` exists and declares 14 claims. After `npm ci` (85
packages added; 0 vulnerabilities), every exact listed command passed from
the clean candidate checkout and demo entry point:

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
| `api-rate-limit` | PASS in isolation — 1 Playwright test |
| `owner-entra-identity` | PASS — 1 Playwright test |
| `container-runtime-contract` | PASS — 1 locked Rust test |

That isolated result is not sufficient for release: `npm run test:e2e` then
failed the same `@claim:api-rate-limit` test in its normal mobile project run
(18 passed, 1 failed). Its 41 concurrent requests received **zero** `429`
responses where exactly one is asserted. Re-running the isolated grep passed,
so the claim test and/or implementation is timing dependent.

## Release-blocking findings

### P1 — live rate limiting does not enforce the stated 41st-request limit

The registered claim and README say: “Read API calls allow 40 requests per
client in each one-second window. Later calls return `429` with
`Retry-After: 1`.”

Fresh live evidence, using one client identity and 45 concurrent
`GET /api/public/settings` calls, was:

```json
{"200":45}
```

There was no `429` and no `Retry-After` header. A fresh 180-concurrent-request
probe did eventually get limits, but only at an observed **170 × 200 and 10 ×
429**, with `Retry-After: 1` on the limited responses. Thus the documented
allowance of 40 is not enforced by the deployed service; the effective limit
is multiplied by active runtime instances and/or time-window races.

This violates the backend rate-limit contract and makes the public claim
false. Use one deployment-wide shared limiter or constrain the runtime so the
observable allowance is truly 40, then make the test deterministic at a
second boundary and re-verify live.

### P1 — the complete end-to-end quality gate is not reliable

`npm run test:e2e` exited 1. The only failure was
`@claim:api-rate-limit` on `chromium-mobile`:

```text
Expected length: 1
Received length: 0
responses.filter(response => response.status === 429)
```

Because this is a registered claim test and the normal all-tests command is a
release gate, the candidate fails even though a subsequent isolated invocation
passed. The current second-based limiter assigns a window independently inside
each request, allowing a concurrent burst that crosses a clock second to evade
the expected threshold.

## Successful verification evidence

- `npm test` passed: 4 Vitest tests and 16 Rust tests.
- `npm run check` passed: TypeScript and Clippy with warnings denied.
- `cargo fmt --check`, `cargo build --release --locked`, and `npm run build`
  passed; `dist/` was produced.
- Production bundles: initial main JS 42.45 kB raw / 13,088 B gzip, helper JS
  0.71 kB / 420 B gzip, CSS 20.34 kB / 5,330 B gzip. The owner-only lazy Entra
  chunk is 260.12 kB / 65,679 B gzip. Initial load is below the 200 kB budget.
- A fresh release binary and SQLite database handled invalid input with 422
  recovery messages, then a valid request (201), owner approval (200), guest
  confirmation (200), repeat confirmation (409), and an ICS response (200,
  `text/calendar`, attachment disposition, `STATUS:CONFIRMED`). Its settings
  persisted after graceful shutdown and restart.
- Owner access at `/manage` is now Sociobot Microsoft Entra External ID only:
  the live UI says so, has no password field, and source/runtime configuration
  uses `sociobotcustomers.ciamlogin.com`.
- Live `/`, `/demo`, and `/manage` were checked at desktop and 390 px. They
  had a title, `lang=en`, one `h1`, one `main`, normal 390 px and 200%-text
  widths of 390 px, visible 3 px focus styling, reduced motion, and no
  console/page errors.
- Live axe-core 4.10.3 checks at 390 px found zero serious or critical
  WCAG 2 A/AA findings on `/` and `/demo`. The factory `verify-url.sh` passed
  both routes after supplying its required evidence directory.
- A direct live demo flow (confirm, record reminder, reset) made only
  same-origin GET requests for the shell/assets, set no cookies, and stored
  only `demo:guest-booking-confirm:state`. No tracking or third-party request
  was observed. The service worker became active and a controlled `/demo`
  reload succeeded offline with no errors.
- Live headers include CSP with response-header `frame-ancestors 'none'`,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, same-origin
  referrer policy, and permissions policy. Shells are `no-cache`; hashed
  assets are immutable for one year. `/robots.txt` and `/sitemap.xml` return
  200 and an unknown route returns an actual 404.
- `/health` returned `build_sha` exactly
  `62ad93dbe42f385d65312a371cdfa7d76370acd0`. Local and live SHA-256 values
  matched for main JS, helper JS, CSS, and the lazy authentication chunk.

## Environment limitation

The supplied worker image has no `docker` executable, so a fresh local Docker
image build/run could not be performed. The live health/build-identity check
and local release-binary run completed; this limitation does not affect the
rate-limit failure above.

## Required repair and re-verification

1. Enforce the 40-read and documented write allowances once per client across
   the live deployment, returning `429` plus `Retry-After: 1` immediately
   after the allowance.
2. Make `@claim:api-rate-limit` deterministic and make the full
   `npm run test:e2e` pass repeatedly.
3. Re-run the exact claims, complete suite, and a fresh live 41-request probe
   before declaring the candidate releasable.
