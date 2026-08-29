# Guest Booking Confirm — independent verification: **FAIL**

Date: 2026-08-29
Work order: `guest-booking-confirm-verify-8`
Candidate: `237968cc2254debd2ed0ea30672f7e3dd61c40e0`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Decision

**FAIL — do not release the advertised paid tier.** The free booking product and
all registered claims passed fresh independent verification, and the live
deployment exactly matches the candidate. However, the visible `$29` Panel Pro
purchase path is not usable: the required Sociobot checkout URL returns HTTP
404. This is a factory billing-registration dependency rather than a source
code defect, but it makes the offered one-time purchase impossible and is a
release blocker for this freemium product.

## P1 release blocker

### P1 — Panel Pro checkout is not registered with Sociobot billing

Fresh GET evidence on 2026-08-29:

```
GET https://api.sociobot.in/api/v1/products/guest-booking-confirm/checkout
HTTP/2 404
{"error":"enabled factory product","status":404}
```

The owner UI advertises **“Buy Panel Pro · $29”** and its link uses exactly this
URL. The product correctly does not embed another payment provider, but a
visitor cannot buy the advertised unlock. Enable/register
`guest-booking-confirm` in the Sociobot billing registry, then recheck the
hosted checkout redirect and return-token flow. No repository code change is
indicated by this finding.

No other release defects were found.

## Cold first read — PASS

In a fresh desktop browser, the first screen says:

- What it does: **“Request and confirm guest appointments.”**
- Who it is for: **“For small businesses that approve times before guests book.”**
- What to do first: **“Try it with sample data”**; adjacent copy says it shows
  a request, owner approval, and confirmation without saving anything.

The button is visible above the fold and opens `/demo` in one click. The demo
banner says “Demo — sample data, nothing is saved” and includes Reset demo and
Start for real.

## Mandatory claim gate — PASS (14/14)

Started from the clean candidate checkout with `npm ci` (85 packages added,
0 vulnerabilities), before other product QA. `.factory/claims.json` exists.
Every exact test command passed:

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
| `owner-entra-identity` | PASS — 1 Playwright test |
| `container-runtime-contract` | PASS — 1 locked Rust test |

## Local candidate verification — PASS

- `npm test` — PASS: 4 Vitest tests and 17 Rust tests.
- `npm run check` — PASS: TypeScript plus Clippy with warnings denied.
- `cargo fmt --all -- --check` — PASS.
- `cargo build --release --locked` — PASS.
- `npm run build` — PASS; `dist/` produced.
- `npm run test:e2e` — PASS: all 19 Playwright tests.

Independent temporary-SQLite API exercise covered unauthenticated owner access
(401), invalid setup (422), invalid consent (422), a valid guest request
(201), owner approval (200), guest confirmation (200), repeat confirmation
(409), invalid reschedule recovery (422), invalid private link (404), and ICS
download (`text/calendar`, attachment filename, `VCALENDAR`,
`STATUS:CONFIRMED`). A SIGTERM shutdown and restart preserved two confirmed
bookings. Local rate tests observed exactly 40 read successes then 1 × 429,
and 12 write successes then 1 × 429; both limited responses sent
`Retry-After: 1`.

Docker is not installed in this worker, so a local image build/run was not
possible. The Dockerfile’s required static contract test passed, and the live
container identity and behavior were verified below.

## Live deployment, privacy, and security — PASS

- `/health` returned `200` and build SHA
  `237968cc2254debd2ed0ea30672f7e3dd61c40e0`.
- Fresh local-vs-live SHA-256 matched for all delivered application chunks:
  main JS `20d0ae…8d9e5`, helper JS `d2a328…0757d0`, CSS
  `6a8924…3016d8`, and lazy auth JS `d7173f…ee46750`.
- Three independent same-client live bursts each produced **40 × 200 + 1 ×
  429**, with `Retry-After: 1`. Observed documented read allowance: 40 per
  rolling one-second window. `/health` remains exempt.
- A fresh live demo confirmation made only same-origin GET requests for the
  shell and assets, made no API/action request, set no cookies, and wrote only
  `demo:guest-booking-confirm:state`. It reloaded in offline mode with the
  confirmed state intact.
- Service worker registration reached `activated`; after reload it controlled
  the page, and an explicit registration update completed with no waiting
  update.
- Live owner access has no password field, names Sociobot Microsoft Entra
  External ID, and its sign-in discovery request targeted
  `sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650`.
- Shell routes use `Cache-Control: no-cache`; hashed assets use
  `public, max-age=31536000, immutable`. `/robots.txt` and `/sitemap.xml`
  return 200; an unknown route returns a real 404. CSP, `nosniff`, DENY
  framing, same-origin referrer policy, and camera/microphone/geolocation
  restrictions are live response headers.

## Accessibility, responsive behavior, and performance — PASS

Desktop and 390 × 844 mobile live checks found one `h1`, one `main`,
`lang=en`, no console/page errors, no horizontal overflow, and no overflow at
200% text on mobile. Keyboard Tab reaches the skip link; Enter moves focus to
`main`; the visible focus outline is `3px rgb(20,109,135)`. Reduced motion
uses `scroll-behavior: auto`.

Fresh axe-core scans on landing and demo at both sizes found zero serious or
critical findings. `/opt/fleet/lib/verify-url.sh` passed live with title,
language, landmark, image-alt, and unlabeled-button checks all clean.

Fresh live Lighthouse: performance **99**, accessibility **100**, best
practices **100**, SEO **100**; FCP 1.20 s, LCP 1.32 s, TBT 96 ms, CLS 0.
Initial delivered main JS is 42,445 B raw / 13,073 B gzip; helper JS is 711 B
/ 420 B gzip; CSS is 20,339 B / 5,318 B gzip. This is within the stated
initial 200 KB JS and 50 KB CSS budgets. The lazy owner-auth chunk is 65,459 B
gzip and is not part of the cold landing load.

## Required next step

The factory must enable the registered Sociobot billing product and re-run the
checkout smoke test. After that external change, this candidate can be
re-verified without a source patch.
