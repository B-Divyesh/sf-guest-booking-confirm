# Independent verification 3 — FAIL

Date: 2026-08-28  
Candidate: `935265f70b2055860153c03b17f08bc04ec9c27f`  
Live URL: <https://guest-booking-confirm.sociobot.in>  
Artifact: web-with-backend

## Decision

**FAIL.** The live service is the requested candidate and the normal workflow is strong, but two release-blocking product defects and the claims-contract defect remain. No product code was changed during this verification.

## First-read test

Fresh, cold live desktop read at `/`:

> Request and confirm guest appointments. For small businesses that approve times before guests book. Try it with sample data.

It plainly says what it does, who it is for, and what to click first. The primary link opens `/demo` in one click. The demo banner says “Demo — sample data, nothing is saved”, has **Reset demo** and **Start for real**, and the sample starts at Maya Chen's owner-approved booking. This gate passes. Screenshot: `qa-artifacts/verification-3-live-cold-desktop.png`.

## Release-blocking findings

### P1 — Guest confirmation link is not single-use under concurrency

The researched brief requires single-use confirm/reschedule/cancel links. Against a clean local release binary and SQLite database, I set up a valid UTC desk, created a request, owner-approved it, then issued two concurrent `POST /api/guest/<token>/confirm` requests. Both returned `200 {"status":"confirmed"}`. Only a later, sequential request returned the expected `409`.

This is a time-of-check/time-of-use race: `guest_confirm` reads `awaiting_confirmation`, then unconditionally updates the row. The transition needs an atomic conditional update (or equivalent transaction) so exactly one request succeeds and all other uses return conflict. The same read-then-write pattern should be reviewed for reschedule/cancel.

Observed result:

```json
{
  "parallelConfirm": [
    {"status": 200, "body": "{\"status\":\"confirmed\"}"},
    {"status": 200, "body": "{\"status\":\"confirmed\"}"}
  ],
  "laterConfirm": {"status": 409}
}
```

### P2 — Invalid opening hours are accepted and silently make the desk unbookable

The owner setup accepts `weekly_hours: {"mon":["17:00","09:00"]}` with `201 Created`. `/api/public/slots?days=14` then returns an empty slot list. The UI permits this range and neither the client nor server tells the owner to make closing time later than opening time. This fails invalid-input/recovery expectations and edge validation. The API must reject malformed, out-of-range, or inverted daily intervals with a clear `422`; the setup form should surface the correction before saving.

### P1 — Claims contract is incomplete

`.factory/claims.json` exists and all three listed claim commands pass, but it does not list every visitor-facing claim as required by the claims contract. Live landing/footer and README include, among others:

- “Guests need no account” / “no guest account”;
- “Owners approve requests before booking”;
- “Free desk allows 30 active future bookings and deletes closed records after 30 days”;
- “Panel Pro ... unlocks unlimited active bookings and 365-day closed-record retention”; and
- “Every API endpoint except `/health` is rate-limited ... and returns `429` with `Retry-After`.”

Some have incidental coverage, but none has an entry and exactly one `@claim:<id>` demo-entry test. Per the supplied claims acceptance rule, an unlisted reliance claim fails review until removed or added with its observable test.

## Required claims run first from clean candidate checkout

`npm ci` completed successfully (84 packages audited; 0 vulnerabilities). Then every command in `.factory/claims.json` was run against the product's Playwright demo entry point:

| Claim ID | Command | Result |
| --- | --- | --- |
| `demo-confirmation-trail` | `npm run test:e2e -- --grep @claim:demo-confirmation-trail` | PASS — 2 tests |
| `demo-local-only` | `npm run test:e2e -- --grep @claim:demo-local-only` | PASS — 2 tests |
| `no-tracking-cookies` | `npm run test:e2e -- --grep @claim:no-tracking-cookies` | PASS — 2 tests |

Fresh live `/demo` confirmation made requests only to the same origin for its shell assets, set no cookies, and left only `demo:guest-booking-confirm:state` in localStorage. No booking API request occurred.

## Passing evidence

- Candidate/deployment identity: live `/health` returned `200 {"build_sha":"935265f70b2055860153c03b17f08bc04ec9c27f","status":"ok"}`.
- Local quality gates: `npm test` passed (4 Vitest + 3 Rust tests); `npm run check` passed (`tsc --noEmit`, `cargo clippy -- -D warnings`); `npm run build` passed; `npm run test:e2e` passed all 11 tests; `cargo build --release --locked` passed.
- Normal end to end: clean local desk setup `201`; invalid booking input returns `422`; a valid guest request returns `201`; owner approval returns `200`; a confirmed booking serves a downloadable ICS with `Content-Type: text/calendar; charset=utf-8` and attachment disposition.
- Desktop and 390px live `/demo`: confirmation flow completed with no console or page errors. Axe found zero serious/critical violations. A keyboard focus check reached **Confirm this time** with `rgb(20, 109, 135) solid 3px` outline and a 46.8px-high target. Reduced-motion media query was honoured. Screenshots: `qa-artifacts/verification-3-live-desktop.png`, `qa-artifacts/verification-3-live-mobile390.png`.
- PWA: on local production build, the service worker controlled `/demo`; offline reload still showed **Ready to confirm**; `registration.update()` completed with the active worker still `/sw.js` and no waiting worker for the unchanged script.
- Privacy/network: the fresh live demo sent no third-party requests and set no cookies. The cold unconfigured landing made only same-origin shell requests plus its documented same-origin `/api/public/settings` read.
- Headers/caching: live HTML has `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, restrictive CSP, and `Cache-Control: no-cache`; hashed JS has `Cache-Control: public, max-age=31536000, immutable`; `/sw.js` has `no-cache`; an unknown path returns an actual HTTP `404` with the designed page.
- Rate limiting: one `X-Forwarded-For` client received `429 Retry-After: 1` on requests 41–42 to the GET endpoint (40 requests/s allowance) and 13–14 to invalid POST booking attempts (12 writes/s allowance). Invalid POSTs did not create data.
- Bundle: initial application JS is 36.18 kB raw / 11.37 kB gzip plus 0.71 kB companion JS; CSS is 19.65 kB raw / 5.21 kB gzip, within the stated static budget.

## Environment limitation

The exact `docker build --build-arg BUILD_SHA=935265f...` command could not be run because this verifier image has no `docker` executable. The equivalent frontend production build and Rust locked release build passed, and the live health response proves the deployed container identifies as the candidate commit. This limitation is not the basis for the FAIL.

## Retest criteria

1. Make all guest state-changing link actions atomic and add a concurrency integration test asserting exactly one `200` and one `409`.
2. Validate every weekly-hours interval server-side and provide an owner-facing correction; add boundary tests for inverted/invalid ranges.
3. Add every live/README reliance claim to `.factory/claims.json` with one demo-entry observable test each, or remove unsupported claim copy.
4. Re-run this verification from a clean checkout and update deployment identity evidence.
