# Guest Booking Confirm — repair 9 handoff

Date: 2026-08-29

Work order: `guest-booking-confirm-repair-9`

Failed candidate: `bacb76f118db1a65945eb83b67437a7f703cf19a`

Verifier report commit: `823548375dbb8c4bba14cf9662f31e54e5d1fc42`

Repair source commit: `edb747a4fe8b26af4898d7a643b0bcce0912550f`

Live URL: <https://guest-booking-confirm.sociobot.in>

Artifact: Rust/axum + SQLite backend serving the Vite/TypeScript frontend from
one container. The researched brief, web-with-backend class, guest and owner
workflows, Entra identity, billing path, data model, and visual system are
unchanged.

## Status

**PASS — the verification-10 release blocker is repaired.**

The live app uses one active revision and one running replica. Three repeated
live read, write, and license-route bursts enforce the documented 40/12
allowances with `429` and `Retry-After: 1`.

## Finding, reproduction, and root cause

Verification 10 found that the live service allowed 80 reads and 24 writes
before limiting. At the start of this repair, Azure reported
`minReplicas=1, maxReplicas=3` for `sf-guest-booking-confirm`, matching the
verifier's evidence that load could reach two independently limited replicas.

The source already had a standalone single-replica helper. The final factory
redeploy did not call it and the factory container deployer reset
`maxReplicas` to 3. SQLite and the rate-limit ledger are replica-local, so that
ordering made the public allowance and booking state depend on which replica
handled a request.

## Repair

- Added `deploy/release.sh` as the required release entry point. It runs the
  work order's standard container deployer and then applies the SQLite topology
  policy. A failure in either step fails the release.
- Strengthened `deploy/enforce-single-replica.sh` to set `minReplicas=1`,
  `maxReplicas=1`, and single-revision mode, then wait until Azure reports one
  active revision and one actually running replica. Desired configuration alone
  no longer counts as success.
- Added `scripts/deployment-contract.test.mjs`. One regression simulates the
  factory deploy resetting the maximum to 3 and proves the release restores the
  complete one-replica topology. A second holds two replicas in service and
  proves the release exits nonzero instead of claiming success.
- Added the deployment regression to `npm test`, extended the existing
  `container-runtime-contract` claim test, and updated the README so operators
  cannot follow the unsafe two-command sequence.

## Clean local verification

- `npm ci` — PASS; 85 packages installed, 86 audited, 0 vulnerabilities.
- `npm test` — PASS: 4 Vitest tests, 20 Rust tests, 1 claims-registry test, and
  2 deployment contract tests.
- `npm run check` — PASS: TypeScript and Clippy with warnings denied.
- `cargo fmt --all -- --check` — PASS.
- `cargo build --release --locked` — PASS from the clean dependency state;
  optimized binary is 14 MB.
- `npm run build` — PASS; `dist/` produced. Main JS is 42,459 bytes raw /
  13,064 bytes gzip; CSS is 20,482 bytes raw / 5,355 bytes gzip; hero WebP is
  41,526 bytes.
- `npm audit --omit=dev` — PASS; 0 vulnerabilities.
- Every command in `.factory/claims.json` — PASS individually, 19/19. The live
  Panel Pro check found the registered USD 29 one-time product and Dodo-hosted
  checkout without making a purchase.
- `npm run test:e2e` — PASS, 22/22 after one preinstalled Chromium process
  crashed during the first run. The exact affected focus test passed on retry,
  followed by a complete clean 22/22 run.
- PORT-only release startup — PASS using default
  `sqlite:/data/guest-booking-confirm.db`; `/health` returned 200 and SIGINT
  logged graceful shutdown.
- Local load smoke — 100 concurrent reads using distinct client identities:
  100 x 200 in 160 ms.
- `/opt/fleet/lib/verify-url.sh` — PASS on local `/` and `/demo`; correct title,
  `lang`, one `h1`, one `main`, alt/accessible names, and no console errors.

## Container deployment and blocker retest

- `deploy/release.sh` — PASS using
  `/opt/fleet/lib/deploy-container.sh guest-booking-confirm /work/repo Dockerfile 8080`.
- ACR build `ch166` — PASS from a source tarball without `.git`.
- Image: `sociobotregistry.azurecr.io/sf-guest-booking-confirm:edb747a4fe8b`.
- Digest: `sha256:c9af149fe56e4b1a799735b59e272227fac4b5ab3711e1d3b27757c56a0c84a7`.
- Healthy revision: `sf-guest-booking-confirm--0000023`, 100% traffic.
- Azure topology after convergence: single revision mode, one active revision,
  one running replica, `minReplicas=1`, `maxReplicas=1`.
- `/health` returned repair source SHA
  `edb747a4fe8b26af4898d7a643b0bcce0912550f`.
- All 14 files in local `dist/` matched the live response byte-for-byte by
  SHA-256.
- Three fresh 41-read bursts each returned exactly 40 x 200 and 1 x 429.
- Three fresh 13-write bursts each returned exactly 12 x 204 and 1 x 429.
- Three fresh 13-license-route bursts each returned exactly 12 x 415 and
  1 x 429. Every 429 above returned `Retry-After: 1`.

The final evidence-only handoff commit is redeployed through `deploy/release.sh`
as well. Completion requires live `/health` to equal final `git rev-parse HEAD`
and the same one-replica topology and burst results to remain true.

## Live browser, accessibility, privacy, offline, and policy evidence

- `/opt/fleet/lib/verify-url.sh` — PASS on live `/` and `/demo`; zero console
  errors and all basic document checks passed.
- Chromium at 1440 x 900 and 390 x 844 covered `/`, `/demo`, `/privacy`,
  `/terms`, and `/manage`. Every route returned 200 with `lang=en`, one `h1`,
  one `main`, no missing alt text, no horizontal overflow, no visible target
  under 44 px, and zero serious/critical axe findings.
- All five routes had zero horizontal overflow at 200% mobile text.
- Keyboard skip navigation moved focus to `main`. The demo focus ring was a
  visible 3 px warm-yellow outline on the dark surface; its target was 48 px.
  Reduced-motion mode used `scroll-behavior: auto` and had no transition or
  animation longer than 0.01 ms.
- A fresh demo confirmation persisted through reload, made no cross-origin or
  booking-action request, set no cookie, and wrote only
  `demo:guest-booking-confirm:state`.
- The service worker controlled the app, updated with no waiting worker, kept
  `/auth/callback` out of caches, and reloaded the confirmed demo offline.
- `/manage` contained no password field and contacted only the required
  `sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650`
  authority. Identity state remained session-only.
- Live HTML sends CSP with header-only `frame-ancestors 'none'`, DENY framing,
  nosniff, same-origin referrer policy, and `Cache-Control: no-cache`. Hashed
  assets are one-year immutable, `/sw.js` is no-cache, and an unknown route
  returns HTTP 404.
- Live Lighthouse mobile — 100 performance / 100 accessibility /
  100 best practices / 100 SEO; FCP 1.2 s, LCP 1.2 s, TBT 0 ms, CLS 0.

## Known gaps

No release-blocking product gap is known. Docker is unavailable in this worker,
so the ACR build is the authoritative clean container/package build. No real
payment was made during the hosted-checkout verification.
