# Independent verification — FAIL

Date: 2026-08-28
Verifier work order: `guest-booking-confirm-verify-1`
Candidate: `57dab139c961a5ad93a1a224155b4ae6d5c11a76`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Verdict

**FAIL — do not release this candidate.** The required claims contract is absent, and the live product has no one-click isolated sample-data demo. Either condition is release-blocking. Fresh deployment evidence also shows that the live booking desk is unconfigured, so a cold visitor cannot make a booking.

## Release-blocking findings

### Critical — claims contract is missing

`.factory/claims.json` does not exist at this candidate. Per the acceptance contract, its absence is a release-blocking finding; there were therefore no listed claim tests that could be run from the demo entry point. This also leaves visitor-facing claims unproved, including the footer's “no tracking cookies” and the README's “No third-party scripts, fonts, advertising trackers, or analytics identifiers are loaded.”

### Critical — no required demo sandbox

There is no `Try it with sample data` action on the live first screen (desktop and 390 px: count `0`), no persistent `Demo — sample data, nothing is saved` banner, no demo storage namespace, and no `.factory/demo.md`. `/demo` falls through to the normal SPA shell, and source inspection finds no demo implementation. The product cannot be tried without configuring a real owner desk, contrary to the demo-sandbox contract.

### High — cold live deployment is not usable for the guest job

Fresh `GET /api/public/settings` returned `{"configured":false}`. On both desktop and 390 px, the cold page reads:

> This booking page is nearly ready. The owner still needs to set service hours. If that’s you, open the owner panel to finish setup.

Its only task action is `Set up the owner panel`. It does not plainly tell a guest that it requests, approves, and confirms appointments, nor provide a booking or sample-data action. This fails the required first-read test and leaves the deployed product unable to perform the researched guest-booking job.

## Other findings

### Medium — required site/discovery and cache controls are absent

No `robots.txt`, `sitemap.xml`, or `staticwebapp.config.json` exists. `frontend/index.html` lacks canonical, Open Graph, and Twitter metadata, and an unknown URL returns HTTP 200 with the SPA shell rather than a designed 404. The live root and hashed JS asset responses have no `Cache-Control` header, so immutable asset caching is not configured.

### Low — required plain-words audit is absent

The mandatory `.factory/copy-audit.md` is not present. This is additionally material because the cold page fails the plain-words first-read gate above.

## Fresh evidence

### Candidate/deployment identity

- `git rev-parse HEAD` was `57dab139c961a5ad93a1a224155b4ae6d5c11a76`.
- Live `GET /health` returned HTTP 200 and `{"build_sha":"57dab139c961a5ad93a1a224155b4ae6d5c11a76","status":"ok"}`.
- SHA-256 of live `/assets/index-ZnhYt0jq.js` matched local `dist/assets/index-ZnhYt0jq.js`: `135bae99857f25b6e40c5d011b273d232d69d24b2681dcd600ff37dde9a567ed`.

### Required local checks

| Check | Result |
| --- | --- |
| `npm ci` | PASS — 0 vulnerabilities reported |
| Claim tests from `.factory/claims.json` | BLOCKED/FAIL — file missing |
| `npm test` | PASS — 4 Vitest and 3 Rust tests |
| `npm run check` | PASS — TypeScript and clippy with warnings denied |
| `npm run build` | PASS — `dist/` produced; JS 32.23 kB (10.45 kB gzip), CSS 18.36 kB (4.94 kB gzip) |
| `npm run test:e2e` | PASS — 2 Playwright tests |
| `cargo build --release --locked` | PASS |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |

The Docker CLI is unavailable in this verification environment, so the container image itself was not run. The exact Vite build and Rust release build stages completed successfully.

### Functional, boundary, and recovery checks (local isolated SQLite database)

- Set up a `Northstar Barber` desk in `America/New_York`; a guest requested a time, the owner approved it, the guest confirmed it, and the calendar endpoint returned HTTP 200 with `STATUS:CONFIRMED`.
- A one-character guest name was rejected by native validation with “Please lengthen this text to 2 characters or more…”, then recovery with a valid name/email succeeded.
- For the 2027-03-14 New York spring-forward boundary, configured Sunday hours `01:00–04:00` returned slots at `01:00`, `01:30`, `03:00`, and `03:30`; the nonexistent 02:00 local hour was absent.
- 100 concurrent local public-settings reads from distinct forwarded client addresses returned 100 HTTP 200 responses.

### Browser, accessibility, privacy, and policy checks

- Local confirmed-booking screen and local 390 px owner screen: axe Playwright reported zero serious/critical violations. No browser console or page errors occurred in the exercised workflow.
- Cold live desktop and 390 px scans: zero axe serious/critical violations and no console/page errors. Keyboard Tab focused the visible skip link; desktop computed focus outline was 3 px.
- Cold live-page requests stayed same-origin. No third-party script/font requests were observed. This is a smoke check only, not a replacement for the required privacy claim test.
- Live responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, a restrictive CSP, and `Permissions-Policy` disabling camera/microphone/geolocation.

### Rate limiting and live backend

- A fresh sequential burst of 45 live `GET /api/public/settings` requests with one `X-Forwarded-For` value returned 40 HTTP 200 responses, then HTTP 429 beginning at request 41. Each 429 had `Retry-After: 1`.
- Live health is available and identifies the requested build SHA. The backend's configured-state endpoint is not healthy for product use because it reports `configured:false` as described above.

## Repair and re-verification prerequisites

1. Add `.factory/claims.json` and one clean-state demo-entry-point test for every visitor-facing claim; make all pass.
2. Implement `/demo` (or `?demo=1`) with realistic sample data, isolated storage, persistent demo banner, reset, and start-for-real actions; document it in `.factory/demo.md` and expose `Try it with sample data` on the first screen.
3. Make the live cold page meet the plain-words first-read gate and ensure the deployed path can demonstrate the guest workflow without writing real booking data.
4. Add required discovery/routing/cache configuration and metadata, including a genuine 404 page and immutable cache policy for hashed assets.
