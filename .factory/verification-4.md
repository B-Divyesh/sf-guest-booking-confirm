# Independent verification 4 — FAIL

Date: 2026-08-28
Candidate: `04da75a04ebe6815e8816b01c8f9fca16d32f3ea`
Live URL: <https://guest-booking-confirm.sociobot.in>
Artifact: web-with-backend

## Decision

**FAIL.** The live application is the requested candidate and the product workflow, privacy, accessibility, and local quality gates pass. However, the candidate violates the mandatory backend Dockerfile contract: [Dockerfile](../Dockerfile) pins a minor Rust image (`rust:1.88-bookworm`) instead of using current stable `rust:1-slim` or `rust:1-alpine`. The contract explicitly prohibits minor pinning because a future dependency resolution can require a newer Rust compiler. This is a release-blocking production-build defect.

No product code was changed during verification.

## Identity and first-read test

- `GET /health` on the live URL returned `200 {"build_sha":"04da75a04ebe6815e8816b01c8f9fca16d32f3ea","status":"ok"}`. The deployed JavaScript asset is `main-aAVthVdE.js`, matching this candidate's production build.
- Cold live page, without prior storage: **“Request and confirm guest appointments”**; **“For small businesses that approve times before guests book.”**; primary action **“Try it with sample data.”** This clearly states the job, audience, and first click. The one-click sample opens `/demo`.
- `/demo` has the persistent **“Demo — sample data, nothing is saved”** banner, **Reset demo**, and **Start for real**. It starts with Maya Chen's approved Northstar Barber request and reaches **Confirmed** plus a sample ICS download.

## Required claim gate

The raw claim commands cannot resolve `@playwright/test` before dependencies are installed in an otherwise clean checkout. After the normal locked `npm ci` clean-install step (84 packages, 0 audit vulnerabilities), every command in `.factory/claims.json` passed:

| Claim | Exact command | Result |
| --- | --- | --- |
| `demo-confirmation-trail` | `npm run test:e2e -- --grep @claim:demo-confirmation-trail` | PASS |
| `demo-local-only` | `npm run test:e2e -- --grep @claim:demo-local-only` | PASS |
| `no-tracking-cookies` | `npm run test:e2e -- --grep @claim:no-tracking-cookies` | PASS |
| `guest-no-account` | `npm run test:e2e -- --grep @claim:guest-no-account` | PASS |
| `owner-approval-before-booking` | `npm run test:e2e -- --grep @claim:owner-approval-before-booking` | PASS |
| `free-desk-capacity-and-retention` | `cargo test --locked claim_free_desk_capacity_and_retention` | PASS |
| `panel-pro-capacity-and-retention` | `cargo test --locked claim_panel_pro_capacity_and_retention` | PASS |
| `api-rate-limit` | `npm run test:e2e -- --grep @claim:api-rate-limit` | PASS |

## Passing verification evidence

- `npm test`: PASS — 4 Vitest tests and 9 Rust tests, including concurrent guest confirmation and owner approval.
- `npm run check`: PASS — `tsc --noEmit` and `cargo clippy -- -D warnings`.
- `npm run build`: PASS — `dist/` produced. Initial JS is 36.99 kB raw / 11.61 kB gzip plus a 0.71 kB companion chunk; CSS is 19.92 kB raw / 5.23 kB gzip.
- `cargo build --release --locked`: PASS. The release binary started with an empty environment (default `PORT=8080` and generated default SQLite path) and returned `{"build_sha":"dev","status":"ok"}` from `/health`.
- `npm run test:e2e`: PASS — 10 Playwright checks covering normal guest request → owner approval → guest confirmation → ICS, owner-hour validation recovery, legal routes, claims, designed 404, immutable assets, and offline demo reload.
- `npm audit --omit=dev`: PASS — 0 vulnerabilities.
- Live desktop and 390px Chromium `/demo` checks: confirmation completed; no horizontal overflow; no console or page errors; zero axe serious/critical violations. Keyboard traversal had a visible 3px focus outline on each reached control. The reduced-motion context reported `scroll-behavior: auto` and a `0.01ms` transition duration. A 200% text-size smoke check had no horizontal overflow.
- Privacy: during the fresh live demo confirmation flow the only requests were same-origin HTML, JS, and CSS; no booking API call or third-party request occurred; cookies were empty; localStorage contained only `demo:guest-booking-confirm:state`.
- PWA: after service-worker control, live `/demo` reloaded while offline and still rendered **Ready to confirm**. `registration.update()` completed with the active `/sw.js` worker and no waiting worker for the unchanged deployment.
- Headers/caching: live HTML has `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, Permissions-Policy, restrictive same-origin CSP, and `Cache-Control: no-cache`. The hashed JS is `public, max-age=31536000, immutable`; an unknown route returns HTTP 404 with the designed page.
- Rate limiting: using one fresh `X-Forwarded-For` client against live `GET /api/public/settings`, requests 1–40 returned 200 and request 41 returned `429` with `Retry-After: 1`. Observed GET allowance: **40 requests per second**. The claim suite separately verifies the stricter write allowance.

## Release-blocking defect

### P1 — Dockerfile pins a prohibited minor Rust release

`Dockerfile:8` is:

```dockerfile
FROM rust:1.88-bookworm AS backend
```

The supplied backend Dockerfile contract requires `FROM rust:1-slim` (or `rust:1-alpine`) and explicitly says never to pin a minor version. A minor-pinned compiler can make an otherwise valid lockfile fail when dependency minimum-Rust requirements advance. Change the builder base to a permitted current-stable Rust tag and rerun the exact Docker build through the factory build path.

The verifier image has no `docker` executable, so the exact local `docker build` could not be executed. This environment limitation is not the basis of the failure: the prohibited image tag is directly present in the candidate source. The live deployment identity confirms that the earlier deployment-only concern is resolved for this candidate.

## Retest criteria

1. Replace the pinned Rust builder image with `rust:1-slim` or `rust:1-alpine` while retaining `ARG BUILD_SHA=dev` and the existing non-root runtime behavior.
2. Verify an ACR/factory Docker build from the repaired commit and redeploy it.
3. Re-run this verification against the new live build SHA.
