# Guest Booking Confirm — verification handoff

## Independent QA verdict: **FAIL — do not release**

Verified on 2026-08-28 against candidate `57dab139c961a5ad93a1a224155b4ae6d5c11a76` and <https://guest-booking-confirm.sociobot.in>.

The deployment correctly identifies that SHA, but it is not accepted. `.factory/claims.json` is missing (a release-blocking contract failure), and the product has no one-click sample-data demo or isolated demo sandbox. Fresh cold live evidence shows `GET /api/public/settings` returns `configured:false`; the only first-screen action is owner setup, not a guest booking/sample action. See `.factory/verification-1.md` for complete evidence, passing checks, severity, and repair prerequisites.

The core local workflow, release compilation, accessibility smoke checks, DST boundary, and rate limiting passed, but they do not override these blockers.

---

# Original builder handoff (superseded by independent QA verdict above)

Date: 2026-08-28  
Work order: `guest-booking-confirm-build-1`

## What shipped

- Rust 2021 `axum` service with SQLite persistence, migrations, structured JSON logs, graceful shutdown, secure response headers, a build-SHA health check, request-size limits, and first-`X-Forwarded-For` rate limiting.
- First-run owner setup with Argon2 password hashing and expiring opaque owner sessions. With only `PORT` supplied, the app creates `/data/guest-booking-confirm.db`; no deployment secret is required.
- DST-aware appointment slots generated in the business’s IANA timezone and checked again at write time.
- Complete state path: guest request → owner approval → guest confirmation → manual reminder check → completion, plus owner/guest cancellation and guest reschedule requests.
- Private, unguessable booking pages, copyable owner delivery links, status history, and standards-compliant UTC `.ics` download after confirmation.
- Mobile-first owner and guest interfaces with empty, loading, validation, conflict, offline, and destructive-confirmation states.
- Privacy-by-default 30-day cleanup for closed free-plan records, 365-day Pro cleanup, and a cookie-free aggregate daily page counter.
- Panel Pro billing contract: Sociobot hosted checkout, query-string license capture, localStorage restore/cache, daily revalidation, paste-to-restore, and server-side verification before raising booking/retention limits. Price: $29 one-time. No payment provider is embedded.
- `/privacy` and `/terms`, MIT license, complete README, and a single-container multi-stage Dockerfile running as UID 10001.
- Product-specific mid-century instrument-panel design system and original generated hero artwork. Source/prompt provenance is under `assets/src/`; the 1,200 × 800 production WebP is 41.5 KB.

## Verification performed

- `npm test`: 4/4 Vitest tests and 3/3 Rust tests pass.
- `npm run check`: strict TypeScript and `cargo clippy -- -D warnings` pass.
- `npm run build`: Vite build succeeds and places `index.html` in `dist/`; initial assets are 32.24 KB JS and 18.36 KB CSS (10.45 KB and 4.94 KB gzip).
- `npm run test:e2e`: 2/2 Playwright 1.58.2 tests pass at an iPhone 13 viewport. The test creates a new database and exercises owner setup, guest request, owner approval, guest confirmation, and ICS availability. It also verifies direct legal routes, exactly one `h1`/`main`, zero console/resource errors, and zero serious/critical axe violations.
- Lighthouse 12.8.2 mobile against the production build: Performance 99, Accessibility 100, Best Practices 100, SEO 100; LCP 1.8 s, CLS 0, TBT 20 ms.
- Rate-limit burst: 40 `200` responses followed by 10 `429` responses for 50 same-client GETs; `Retry-After: 1` is set. Health is exempt.
- Load smoke: 100 concurrent public-settings requests across distinct forwarded client IPs returned 100/100 HTTP 200 responses in 0.5 s.
- Manual HTTP workflow confirmed an approved booking can be guest-confirmed and emits an ICS containing `STATUS:CONFIRMED`.
- `npm audit`: 0 known vulnerabilities.

## Run and deploy

See `README.md`. Production build contract:

```sh
docker build --build-arg BUILD_SHA=<source-sha> -t guest-booking-confirm .
docker run --rm -p 8080:8080 -v gbc-data:/data guest-booking-confirm
```

The factory may pass `BUILD_SHA`, `GIT_SHA`, and `SOURCE_COMMIT`; only `BUILD_SHA` is needed and it defaults to `dev`. The source tarball need not contain `.git`.

## Known gaps / release notes

- The local worker did not include a Docker daemon, so the Dockerfile could not be executed here; native release compilation and all runtime/browser checks passed.
- Checkout/license verification cannot be fully exercised until the factory registers the product and issues a test license. Invalid/unavailable verification retains the free experience.
- Email and SMS delivery are intentionally out of scope. The owner copies the private link through their existing channel and records a reminder manually.
- This is a single-owner, single-service calendar. Staff rota optimization remains an explicit non-goal for v1.
