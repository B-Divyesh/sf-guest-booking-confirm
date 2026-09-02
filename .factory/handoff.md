# Guest Booking Confirm — repair 14 handoff

Date: 2026-09-02 UTC
Work order: `guest-booking-confirm-repair-14`
Live URL: <https://guest-booking-confirm.sociobot.in>
Repair commit deployed: `7449611b95e91f80d8618789d052a6bb67f2cc8f`

## Outcome

**PASS — the SQLite topology and deterministic API allowance are restored.**

The serving Container App revision is
`sf-guest-booking-confirm--0000046`, running image
`sociobotregistry.azurecr.io/sf-guest-booking-confirm:7449611b95e9`.
It has the fleet-managed `sf-guest-booking-confirm-data` Azure Files volume
mounted at `/data`, one active revision, and one running replica. The live
release wrapper proved the documented 40-read and 12-write limits three times;
every boundary response was `429` with `Retry-After: 1`.

## The failure reproduced first

Before any change, the exact candidate image `995591b2dd52` failed the serving
topology gate:

```text
template(... min=1 max=3 volumes=0 mounts=0 ...);
revision(... min=1 max=3 volumes=0 mounts=0); active_revisions=1 running_replicas=3
topology_gate_exit=1
```

The complete captured output is
[`.factory/qa-artifacts/repair-14-topology-before.txt`](qa-artifacts/repair-14-topology-before.txt).

## What changed

- Replaced product-owned Azure storage/template scripts with a small release
  wrapper around the fleet container deployer. It refuses release unless the
  work order declares `deploy.data_dir: /data` (`WO_DATA_DIR=/data`).
- The fleet now owns the `sf-guest-booking-confirm-data` share, `/data` mount,
  and one-replica setting. No product script creates storage or patches a
  Container App template.
- Strengthened the active-revision topology gate: desired template and serving
  revision must use the exact fleet volume (`data` → `/data`), have exactly one
  volume/mount, one active revision, and one running replica.
- Added regressions for the verifier's exact unmounted `maxReplicas: 3` state,
  additional product-created storage, missing `/data` work-order configuration,
  and the three-replica multiplied rate-limit signature.

## Verification

Clean local run:

```sh
npm ci                         # 85 packages; 0 vulnerabilities
npm test                       # PASS: 4 Vitest, 21 Rust, claims, 8 deploy/rate tests
npm run check                  # PASS: TypeScript + clippy -D warnings
cargo fmt --all -- --check     # PASS
npm run build                  # PASS; dist/ created
cargo build --release --locked # PASS; 14 MB binary
npm run test:e2e               # PASS: 24 Chromium desktop/mobile workflows
npm run test:billing           # PASS: live $29 Sociobot hosted-checkout smoke
```

The Playwright suite covers keyboard operation, 390 px layout, 200% text,
reduced motion, offline reload/update, demo privacy, private booking links,
owner identity, and Playwright AxeBuilder scans. The standalone `@axe-core/cli`
could not launch because this worker has no system Chrome binary; the existing
Playwright AxeBuilder integration is the equivalent browser-backed scan and
passed with zero serious/critical findings.

Local URL smoke passed with title, `lang=en`, one h1, one main landmark, no
missing image alt text, no unlabeled buttons, and no console errors. Evidence:
[`.factory/qa-artifacts/repair-14-verify-url/verify.json`](qa-artifacts/repair-14-verify-url/verify.json).

Deployment and final live evidence:

```sh
npm run deploy
TOPOLOGY_WAIT_ATTEMPTS=1 TOPOLOGY_WAIT_SECONDS=0 \
  ./deploy/verify-live-topology.sh sociobot sf-guest-booking-confirm \
  sociobotregistry.azurecr.io/sf-guest-booking-confirm:7449611b95e9
```

Both topology checks passed. `/health` returned the exact full commit SHA.
The release's three repeated live boundary probes passed: 40 reads then 429,
12 page views then 429, and 12 malformed license checks then 429, all with
`Retry-After: 1`. Live response headers include CSP, `nosniff`, `DENY`,
same-origin referrer policy, and restrictive permissions policy.

Independent live Playwright checks covered `/`, `/demo`, `/privacy`, `/terms`,
and `/manage` at 1440×900 and 390×844: all returned 200 with one h1/main, zero
horizontal overflow, no console errors, no missing alt text, and zero
serious/critical axe findings. The live demo had no cookies, API requests, or
cross-origin requests; it wrote only `demo:guest-booking-confirm:state` and
reloaded offline in its confirmed state. Keyboard skip navigation focused
`main`, and owner sign-in exposed no password field and requested only the
required Sociobot Entra authority. The live URL verifier evidence is at
[`.factory/qa-artifacts/repair-14-live-verify-url/verify.json`](qa-artifacts/repair-14-live-verify-url/verify.json).

## Operating notes

- Local development defaults to a local SQLite path. The container defaults to
  `sqlite:/data/guest-booking-confirm.db` and serves on `PORT` (8080 by
  default) with no required secret environment variables.
- Factory deployment must keep `deploy.data_dir: /data`; use `npm run deploy`
  only inside a factory worker, where it delegates to the fleet deployer.
- The durable share is intentionally empty: the prior release had no mounted
  data volume, and no owner or booking data was fabricated during repair. A
  real owner signs in at `/manage` to create the desk; this is the normal
  first-run state.

## Known gaps / next step

No functional release blockers remain. The first real owner should configure
the desk through `/manage`; after that, their settings and bookings persist on
the fleet-managed `/data` share across revisions.
