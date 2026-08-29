# Guest Booking Confirm — repair 11 handoff

Date: 2026-08-29
Work order: `guest-booking-confirm-repair-11`
Verifier report: `50244ef05f7c7465d83f655f75703f993bbed37e`
Rejected candidate: `23cb8cc4f991ef2d01a02f3f3b9bea4fb135f069`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Outcome

Both verification-12 P1 findings are repaired.

1. The cold first screen now says “Request and confirm guest appointments,”
   names microbusinesses, makes the one-click sample the primary action, and
   explains that it opens Maya’s approved request at the confirmation step.
   The editorial date board and every previously passing product flow remain.
2. `npm run deploy` is now the canonical release entry point. It repairs the
   factory deployer’s `maxReplicas=3`/no-volume template, mounts a private Azure
   Files share at `/data`, enforces one active revision and one running replica,
   then proves the live 40-read and 12-write rolling limits three times. SQLite
   uses a rollback journal, the dot-file VFS, and one pooled connection because
   WAL/shared-memory and POSIX byte-range locks are not reliable on that mount.

## Exact regression coverage

- `tests/booking-flow.spec.ts` requires the corrected job, audience, demo
  action outcome, privacy/offline/price facts, 8-week sample board, keyboard
  interaction, 390 px layout, and 200% text reflow.
- The offline test is registered as `@claim:offline-reload` and proves a cached
  `/demo` reload after the browser is disconnected.
- `scripts/deployment-contract.test.mjs` starts from the factory’s exact unsafe
  state (`max=3`, two running replicas, no persistent mount), asserts that the
  release creates/restores `/data`, waits while its visible mount still reports
  provisioning in progress, and rejects a release if two replicas remain.
- `scripts/release-verification.test.mjs` proves the live gate rejects the
  doubled two-replica signature and accepts only 40 reads plus one `429`, and
  12 writes plus one `429`, each with `Retry-After: 1`.
- `claim_container_runtime_contract` locks the Azure Files mount, rollback
  journal, one-connection pool, UID, port, `/data`, build identity, and graceful
  shutdown contracts.

## Clean verification

- `npm ci` — PASS; 85 packages installed, 86 audited, 0 vulnerabilities.
- All 21 commands in `.factory/claims.json` — PASS individually, including the
  live Sociobot USD 29.00 hosted-checkout smoke without a purchase.
- `npm test` — PASS: 4 Vitest tests, 20 Rust tests, the claims registry test,
  and 5 deployment/release tests.
- `npm run check` — PASS: TypeScript and Clippy with warnings denied.
- `cargo fmt --all -- --check` — PASS.
- `cargo build --release --locked` — PASS.
- `npm run build` — PASS; `dist/` produced. Initial JS is 49,010 bytes raw /
  15.03 KB gzip; CSS is 36,877 bytes raw / 8.43 KB gzip. Owner identity remains
  a lazy 260,119-byte chunk / 65.99 KB gzip.
- `npm run test:e2e` — PASS, 22/22 on desktop and 390 px Chromium. One earlier
  run reached 21/22 before Chromium itself segfaulted while creating a context;
  the exact keyboard-contrast test passed 1/1 and the clean full rerun passed.
- Factory `verify-url.sh` — PASS on local `/` and `/demo`: one H1, `lang=en`,
  main landmark, complete image alt handling, and no console errors. Captures
  and JSON are under `.factory/qa-artifacts/repair-11-local-{root,demo}/`.
- Playwright axe — zero serious/critical findings on the landing, demo, legal,
  and completed-booking states. Keyboard skip/focus, 3:1 focus indicators,
  reduced motion, 200% text, 44 px targets, and no 390 px overflow pass.
- Demo privacy — only same-origin requests, no cookie, no booking API action,
  and only `demo:guest-booking-confirm:state` in local storage. The service
  worker excludes `/auth/callback`; update and offline `/demo` reload pass.
- Local response policy — CSP includes response-header-only
  `frame-ancestors 'none'`; `nosniff`, `DENY`, same-origin referrer policy, and
  denied camera/microphone/geolocation are present. HTML/auth are `no-cache`,
  hashed assets are immutable, and an unknown route returns the designed 404.
- Mobile Lighthouse — 99 performance, 100 accessibility, 100 best practices,
  100 SEO; FCP 1.5 s, LCP 2.0 s, TBT 50 ms, CLS 0. Evidence:
  `.factory/qa-artifacts/repair-11-lighthouse-local.json`.
- Port-only runtime — PASS with an empty environment except `PORT=4180`; the
  server used `/data`, returned health, and logged graceful SIGTERM shutdown.
- Backend load smoke — 100 concurrent public API reads, 100 × 200 in 729 ms
  (137 requests/second) with the final rollback-journal/one-connection setup.
- Docker is unavailable locally. The guarded `npm run deploy` therefore uses
  the work order’s ACR cloud build; it passes only after the built SHA, mounted
  storage, one-replica topology, and repeated live limiter boundaries pass.

## Deployment evidence

`npm run deploy` completed from the final pushed commit. The factory ACR build
succeeded, `/health` matched `git rev-parse HEAD`, and Azure reported:

- active revision mode: `Single`;
- scale: `minReplicas=1`, `maxReplicas=1`;
- one active revision and one running replica;
- volume `gbc-data` backed by environment storage
  `guest-booking-confirm-data`, mounted at `/data`;
- three fresh read bursts: 40 × 200 then one 429 with `Retry-After: 1` each;
- three fresh write bursts: 12 × 204 then one 429 with `Retry-After: 1` each.

Post-deploy factory URL checks pass on `/` and `/demo`, and the live first screen
contains the corrected H1 and microbusiness description at desktop and 390 px.

## Known gaps and next steps

No release-blocking gap is known. Package/consumer checks do not apply to this
web-with-backend artifact. An independent verifier should rerun verification-12
against the final `/health` build identity.
