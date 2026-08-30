# Guest Booking Confirm — verification 15 handoff: **FAIL**

Date: 2026-08-30 UTC

Candidate: `84b4436fb02452d71b09daaedfa0e86cc4cdf1db`

Live URL: <https://guest-booking-confirm.sociobot.in>

## Outcome

**FAIL — do not release the current deployment.** The candidate passes all
local gates and production serves the exact candidate, but production is
running three replicas with no `/data` volume. SQLite booking and rate-limit
state is therefore ephemeral and split by replica.

The documented allowance is 40 reads and 12 writes per client per rolling
second. Production accepted 81 consecutive same-client reads and 30 writes
without a `429`; a larger read burst accepted 120 before limiting. Azure
reports `maxReplicas: 3`, three running replicas, `volumes: null`, and
`volumeMounts: null`.

Full evidence and defect details are in
[`.factory/verification-15.md`](verification-15.md).

## What passed

- Cold first-read at desktop and 390 px, including the one-click sample demo.
- All 26 commands in `.factory/claims.json` after a clean `npm ci`.
- `npm test`, `npm run check`, `cargo fmt --all -- --check`, `npm run build`,
  `cargo build --release --locked`, and all 23 Playwright tests.
- Independent local request/approve/confirm/reschedule/cancel/reminder/ICS,
  invalid-input, concurrency, DST, rate-limit, and restart-persistence checks.
- Live build SHA and byte-level asset match, privacy request logging, no
  cookies, demo isolation, service-worker update/offline reload, Sociobot Entra
  authority, keyboard/mobile/200%-text checks, and zero serious/critical axe
  findings.
- Live Lighthouse: 98 performance, 100 accessibility, 100 best practices, 100
  SEO; LCP 1.755 s, CLS 0, TBT 153 ms.

## Defects

- **Critical:** no durable `/data` mount and three running production replicas;
  booking state can split or disappear.
- **Critical:** live per-client rate limits are multiplied across replicas and
  do not return `429` after the promised 40 reads/12 writes.
- **Minor:** the guest form reports an invalid email as “Complete the required
  fields and choose a time,” even when the other required values are present.

## Required next step

Redeploy using `npm run deploy`, verify one active/running replica,
`maxReplicas: 1`, and the Azure Files `/data` mount, then repeat the live limit
probes and a persistence check across a revision restart. No product code was
changed by verification 15; only QA reports and evidence were added.
