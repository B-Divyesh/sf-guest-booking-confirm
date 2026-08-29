# Guest Booking Confirm — repair handoff

Date: 2026-08-29
Work order: `guest-booking-confirm-repair-12`
Base verifier report: `210e915f47ce27e0d42e891716e665c982f18532`
Rejected candidate: `b7399716331e77abb237c08af39e19efaa42af72`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Outcome

The verification-13 P1 is repaired. The Rust limiter already correctly
enforced 40 reads and 12 writes in one process; the fault was the release
topology. The live Container App template was allowed to revert to the
factory's unsafe defaults after a generic deployment. That can split a
SQLite-backed rate ledger during scaling and made the documented write limit
unreliable.

The new release path builds the exact committed source in ACR and never calls
the generic max-three/no-volume publisher. It registers Azure Files, converges
the currently serving app to one active revision and one running replica, then
publishes the next image in one ARM template patch containing all of:

- Azure Files volume `gbc-data` mounted at `/data`;
- `minReplicas=1` and `maxReplicas=1`;
- the exact ACR image tagged from the source commit and `PORT=8080`.

It proves that template before traffic verification, repeats the one-replica
check after, and makes the template/mount check its final action. The live
gate now checks three fresh clients each for 40 reads, 12 page-view writes,
and 12 malformed license-verification writes; every overflow must return
`429` with `Retry-After: 1`.

## Reproduction and root-cause evidence

Against the unrepaired live candidate, this read-only check failed exactly as
the verifier described:

```text
SAFE_TEMPLATE_VERIFY_ONLY=1 ./deploy/apply-safe-template.sh sociobot sf-guest-booking-confirm
Safe template verification failed ... image=...:b7399716331e min=1 max=3 volumes=0 mounts=0 provisioning=Succeeded.
```

The same candidate's live endpoint reproduced the source behavior while it
was on one current replica: a 45-read burst returned 40 `200` and 5 `429`; a
14 page-view burst returned 12 `204` and 2 `429`; a fresh 14 malformed
license-verification burst returned 12 `422` and 2 `429`, every limit response
with `Retry-After: 1`. The unsafe template remained a release blocker because
it could scale or restart into split state.

## Exact regression coverage

- `scripts/deployment-contract.test.mjs` begins with the verifier's exact
  unsafe state: `max=3`, no Azure Files volume, no `/data` mount. It requires
  the ACR image patch to contain the image, `/data`, and `min=max=1` together;
  it rejects completion if two replicas still serve before the new image is
  published.
- `deploy/apply-safe-template.sh` polls and rejects a template without the
  exact mount, image, one-replica scale, or successful provisioning state.
- `scripts/verify-release.mjs` and its tests prove three independent read,
  page-view, and malformed-license boundaries. The split-replica fixture is
  rejected.
- `@claim:api-rate-limit` now covers the public 40-read promise plus the
  documented 12-write behavior for both page views and license checks.
- `claim_container_runtime_contract` locks the ACR build, safe-template,
  Azure Files, one-replica, UID, port, SQLite, and graceful-shutdown contract.

## Verification completed

- `npm ci` — PASS: 85 packages installed, 86 audited, 0 vulnerabilities.
- `npm test` — PASS: 4 Vitest tests, 20 Rust tests, claim registry, and 5
  deployment/release-contract tests.
- `npm run check` — PASS: TypeScript and Clippy with warnings denied.
- `cargo fmt --all -- --check` — PASS.
- `npm run build` — PASS; `dist/` produced. Initial main JS is 49,006 bytes
  raw / 15.03 KB gzip; CSS is 36,877 bytes raw / 8.43 KB gzip. The 260,119
  byte authentication module remains lazy loaded (65.99 KB gzip).
- `cargo build --release --locked` — PASS; release binary is 14 MB.
- Every one of the 21 exact commands declared in `.factory/claims.json` —
  PASS individually: 14 sandboxed Playwright claims, six locked Rust claims,
  and the live no-purchase USD 29.00 Sociobot checkout smoke.
- `npm run test:e2e` — PASS: 22 Chromium desktop/390px workflows. It covers
  keyboard skip/focus, mobile touch targets and 200% text, demo isolation,
  local-only privacy, offline reload, service-worker update behavior, owner
  Entra identity, response headers, and the full booking trail.
- Factory `verify-url.sh` — PASS locally on `/` and `/demo`: no console/page
  errors; titles, `lang=en`, one `h1`, main landmark, image alt text, and
  labeled buttons are present. Measured local loads were 603 ms for `/` and
  520 ms for `/demo`.
- Playwright axe — PASS: zero serious/critical findings at 390px on `/`,
  `/demo`, `/privacy`, `/terms`, and `/manage`. The attempted axe CLI could
  not start because this container has no `chromedriver`; the repository's
  Playwright axe integration uses the preinstalled Chromium instead.
- Local response policy — PASS: `nosniff`, `DENY`, same-origin referrer,
  denied camera/microphone/geolocation, CSP response-header
  `frame-ancestors 'none'`, no-cache HTML, immutable assets, and designed 404.
- Port-only runtime — PASS with `env -i PORT=4181`: default
  `sqlite:/data/guest-booking-confirm.db`, `/health` 200, and graceful SIGINT
  shutdown. Docker is unavailable in this worker, so the real container image
  build is performed by ACR in `npm run deploy`.

## Deployment and final live verification

`npm run deploy` is the only release entry point. It builds this committed
source in ACR, publishes the safe template, checks `/health` against the
commit SHA, and repeats all three live rate-limit boundaries before returning
success. It also fails before publication if the existing app cannot converge
to one running replica. After deployment, re-run the same command to verify
the current live identity, template, and limiter boundaries.

## Known gaps / next steps

No product-scope or release-blocking gaps are known. Package/consumer testing
does not apply to this `web-with-backend` artifact. A future independent
verification should use the live deployment identity and repeat the bounded
read/page-view/license bursts.
