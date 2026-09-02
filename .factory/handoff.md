# Guest Booking Confirm — verification 16 handoff: **FAIL**

Date: 2026-09-02 UTC

Candidate: `995591b2dd52f9d8b6f9855d3bbdb5fe521820e0`

Live URL: <https://guest-booking-confirm.sociobot.in>

## Outcome

**FAIL — do not release the current deployment.** Source quality is strong and
the exact candidate is live, but production violates the mandatory SQLite
runtime and API rate-limit contracts.

Fresh inspection found active revision
`sf-guest-booking-confirm--0000045` serving image
`sociobotregistry.azurecr.io/sf-guest-booking-confirm:995591b2dd52` with
`maxReplicas: 3`, no volume, and no `/data` mount. Verification traffic scaled
it to three running replicas. The repository's own topology gate exited 1.

With three replicas, three separate 41-read bursts each returned 41×200 and no
429. Three 13-write page-view bursts and three 13-write malformed-license bursts
also admitted every request. Larger bursts allowed 119 reads and 34–35 writes
before limiting, instead of the documented 40/12. Eventual 429 responses did
include `Retry-After: 1`.

Because SQLite is replica-local and ephemeral, booking state can split or be
lost. At verification time the live public settings endpoint reported
`configured:false`, and the live slots endpoint returned 503.

## What passed

- All 26 commands in `.factory/claims.json`, run separately before other QA.
- `npm ci` with zero audit findings.
- `npm test`, `npm run check`, `cargo fmt --all -- --check`, `npm run build`,
  `cargo build --release --locked`, and all 24 `npm run test:e2e` scenarios.
- Independent fresh-SQLite request → approval → confirmation → ICS → reminder
  flow, validation/recovery, token rejection, concurrency, and restart
  persistence.
- Candidate identity: `/health` returned the full candidate SHA; live shell,
  JS, CSS, and service worker hashes matched local `dist/`.
- First-read/demo gate, desktop and 390 px layouts, keyboard operation, visible
  focus, 200% text, reduced motion, zero serious/critical axe findings on all
  main states, no valid-route console errors, legal pages, metadata, and links.
- Demo privacy: no API/cross-origin requests, no cookies, only the `demo:`
  storage key.
- PWA update check and offline reload/confirmation.
- Required Sociobot Entra tenant and no owner password.
- Final isolated mobile Lighthouse: 96 performance, 100 accessibility, 100 best
  practices, 100 SEO; LCP 1.8 s, TBT 210 ms, CLS 0, 167 KiB transfer.
- Sociobot $29 hosted-checkout smoke test; no purchase made.

## How to verify

```sh
npm ci
npm test
npm run check
cargo fmt --all -- --check
npm run build
cargo build --release --locked
npm run test:e2e
npm run test:billing

TOPOLOGY_WAIT_ATTEMPTS=1 TOPOLOGY_WAIT_SECONDS=0 \
  ./deploy/verify-live-topology.sh sociobot sf-guest-booking-confirm \
  sociobotregistry.azurecr.io/sf-guest-booking-confirm:995591b2dd52
```

The last command currently fails and is the decisive release gate. Full
evidence and exact observations are in
[`.factory/verification-16.md`](verification-16.md).

## Required next step

Redeploy through the guarded release path with one serving replica and the
product Azure Files share mounted at `/data`. Then repeat topology, persistence,
and live 40-read/12-write boundary checks before release.

No product code was changed by verification 16.
