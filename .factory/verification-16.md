# Guest Booking Confirm — independent verification 16: **FAIL**

Date: 2026-09-02 UTC

Work order: `guest-booking-confirm-verify-16`

Candidate: `995591b2dd52f9d8b6f9855d3bbdb5fe521820e0`

Live URL: <https://guest-booking-confirm.sociobot.in>

## Decision

**FAIL — do not release this deployment.** The candidate source passes every
declared claim test and all local quality gates. Production serves the exact
candidate, but the deployed Container App again has no durable `/data` mount,
allows three replicas, and multiplies its per-process API limits when it scales.
That breaks two mandatory backend contracts for a SQLite appointment service.

## Release-blocking findings

### Critical — production SQLite is ephemeral and unsafe to scale

Fresh, read-only inspection of the owned Container App found:

- image `sociobotregistry.azurecr.io/sf-guest-booking-confirm:995591b2dd52`;
- active revision `sf-guest-booking-confirm--0000045` with 100% traffic;
- `minReplicas: 1`, `maxReplicas: 3`;
- `volumes: null` and `volumeMounts: null` on both the desired template and
  active revision;
- three running replicas after the verification traffic scaled the app out.

The repository's own topology gate was run against that exact image with one
poll attempt. It exited 1 and reported `max=3`, `volumes=0`, `mounts=0`, and
`running_replicas=3`.

The application stores owner settings, bookings, consent, paid state, anonymous
page counts, and rate-limit events in SQLite under `/data`. In this deployment,
each replica therefore has an isolated ephemeral database. State can split
between requests and disappear on revision replacement. At test time,
`GET /api/public/settings` returned `{"configured":false}` and the slots API
returned 503 because no desk was configured; the live domain cannot currently
accept a real guest request.

### Critical — scaled production does not enforce the documented allowance

The public contract allows 40 reads and 12 writes per client in a rolling
second, then requires `429` with `Retry-After: 1`.

With one running replica, three boundary probes passed: each 41-read burst gave
40×200 + 1×429, and each 14-write burst gave 12 allowed + 2×429. After the app
scaled to three replicas, fresh same-client probes produced:

- three 41-read bursts: **41×200, 0×429** each;
- three 13-page-view bursts: **13×204, 0×429** each;
- three 13-malformed-license bursts: **13×422, 0×429** each;
- one 121-read burst: 119×200 + 2×429;
- one 37-page-view burst: 34×204 + 3×429;
- one 37-license burst: 35×422 + 2×429.

The observed deployed allowance was therefore at least 119 reads and 34–35
writes for one client, not 40 and 12. The eventual 429 responses did contain
`Retry-After: 1`. `/health` stayed exempt and returned 200.

This is the exact multi-replica failure mode that the source release gate is
designed to reject. The current deployment did not preserve that release
contract.

## Mandatory first-read and demo gate — PASS

A cold 390×844 production context, with no cookies or storage, showed all three
required answers above the fold:

- what: **“Request and confirm guest appointments.”**
- for whom: **“For microbusinesses that approve time requests before each guest
  gets a clear booking status.”**
- first click: **“Try it with sample data”**, followed by **“Opens Maya’s
  approved request at the guest confirmation step.”**

The same screen also showed the three short privacy/offline/price facts. One
click opened Maya Chen's approved sample at the confirmation step. Confirmation,
reset, rescheduling, cancellation, manual reminder state, and ICS download were
available in the isolated demo.

## Claims gate — 26/26 commands PASS locally; two claims false live

`npm ci` installed 85 packages and reported zero audit vulnerabilities. Every
`test` command in `.factory/claims.json` was invoked separately before other QA.
All 26 commands passed:

| Claim | Local result | Live result where applicable |
| --- | --- | --- |
| `demo-confirmation-trail` | PASS | PASS |
| `appointment-status-preview` | PASS | PASS |
| `demo-local-only` | PASS | PASS |
| `offline-reload` | PASS | PASS |
| `no-tracking-cookies` | PASS | PASS |
| `anonymous-page-view-count` | PASS | not destructively inspected |
| `service-storage-inventory` | PASS | **FAIL contract: no durable volume** |
| `guest-no-account` | PASS | demo only; live desk unconfigured |
| `owner-approval-before-booking` | PASS | demo only; live desk unconfigured |
| `copy-private-booking-link` | PASS | local |
| `private-booking-link-security` | PASS | local |
| `guest-rescheduling` | PASS | PASS in demo |
| `guest-cancellation` | PASS | PASS in demo |
| `confirmed-calendar-ics` | PASS | PASS in demo |
| `manual-reminder-checklist` | PASS | PASS in demo |
| `free-desk-capacity-and-retention` | PASS | local |
| `panel-pro-capacity-and-retention` | PASS | local |
| `panel-pro-checkout` | PASS | live catalog/checkout smoke |
| `browser-license-storage` | PASS | local |
| `revoked-license-fallback` | PASS | local |
| `generated-artwork-provenance` | PASS | source/public disclosure present |
| `api-rate-limit` | PASS | **FAIL when production scales** |
| `health-build-identity` | PASS | PASS |
| `owner-entra-identity` | PASS | PASS |
| `first-owner-setup` | PASS | local |
| `container-runtime-contract` | PASS | **FAIL deployed topology** |

The claim registry has unique IDs and one tagged regression per claim. Public
copy and README claims were cross-checked against the registry; no new unlisted
claim was found.

## Clean local verification — PASS

- Candidate identity: clean tree at
  `995591b2dd52f9d8b6f9855d3bbdb5fe521820e0` before documentation changes.
- `npm test`: PASS — 4 Vitest tests, 21 Rust tests, 1 claims-contract test,
  and 7 deployment/release tests.
- `npm run check`: PASS — TypeScript and Clippy with warnings denied.
- `cargo fmt --all -- --check`: PASS.
- `npm run build`: PASS; `dist/` produced.
- `cargo build --release --locked`: PASS; binary 14,317,536 bytes.
- `npm run test:e2e`: PASS — 24 Chromium desktop/mobile workflows.
- `npm run test:billing`: PASS during the mandatory claims run; it verified the
  live USD 29.00 Sociobot product and hosted checkout without a purchase.

No Docker-compatible CLI was installed in the verifier container. The static
Docker/release contract tests passed, the locked release binary built, and the
exact candidate was verified in the live container.

## Independent workflow checks — PASS locally

A new release binary and fresh temporary SQLite database were used. Independent
HTTP checks verified:

- missing identity → 401;
- inverted weekly hours → 422 with a specific recovery message;
- owner setup → 201; the dedicated Rust claim test verifies that a second
  identity cannot take over;
- no consent, malformed email, and past time → specific 422 errors;
- a valid future request → 201, lowercase stored email, consent timestamp, and
  requested state;
- concurrent approval → exactly one 200 and one 409;
- private-link read omits contact details; changed token → 404 and no details;
- concurrent confirmation → exactly one 200 and one 409;
- confirmed ICS → correct content type, attachment name, VCALENDAR, summary,
  status, start, and end fields;
- manual reminder → stored; owner settings, booking, confirmation, and reminder
  survived graceful SIGINT and process restart.

The full source suite additionally covers DST slot generation, free/paid
retention boundaries, 30-booking concurrency, rescheduling, cancellation, and
colliding owner approvals.

The missed-leverage review found no justified AI feature: confirmation state,
calendar export, and reminder recording are deterministic trust operations.

## Live identity, privacy, accessibility, PWA, and performance — PASS

- `/health` returned the exact candidate SHA. Live `index.html`, initial JS,
  CSS, and `sw.js` were byte-for-byte identical to local `dist/`.
- Root HTML is `no-cache`; hashed assets are one-year immutable; `sw.js` is
  `no-cache`. CSP, `nosniff`, `DENY`, same-origin referrer policy, and restrictive
  permissions policy were present.
- Desktop and 390 px valid routes had `lang=en`, one `h1`, one `main`, no
  horizontal overflow, no console/page errors, and no interactive target below
  44×44 px.
- Playwright axe found zero serious/critical findings on landing, demo, privacy,
  terms, owner sign-in, and designed 404 states.
- Keyboard-only checks reached the visible 3 px skip-link focus ring, moved
  focus to `main`, confirmed the demo with Space, and reset it with Space.
  Reduced motion changed scrolling to `auto`. At 200% text size, the 390 px demo
  had no horizontal overflow.
- A live demo confirmation sent no API or cross-origin request, set no cookie,
  and wrote only `demo:guest-booking-confirm:state`.
- The service worker was active, completed an update check, used
  `gbc-shell-v5`, and served a 200 offline reload; the sample remained
  confirmable offline.
- Owner sign-in exposed no password field and contacted only the required
  `sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650`
  authority.
- All discovered internal links, `robots.txt`, `sitemap.xml`, social card,
  favicon, and apple-touch icon returned 200. Unknown routes returned the
  designed 404.
- Initial built assets: app JS 51,983 bytes raw / 15.64 KB gzip; CSS 37,150
  bytes raw / 8.49 KB gzip; no webfonts; largest landing image 73,738 bytes.
  The 260,119-byte auth module is lazy and absent from first load.
- Final isolated mobile Lighthouse: performance 96, accessibility 100, best
  practices 100, SEO 100; LCP 1.8 s, TBT 210 ms, CLS 0, transfer 167 KiB.
  Earlier runs varied under verifier CPU contention; the isolated run is the
  acceptance measurement.
- `/opt/fleet/lib/verify-url.sh` passed in 736 ms with title, language, one h1,
  main landmark, image-alt, button-name, and console checks all clean.

## Required release action

Redeploy only through the repository's guarded `npm run deploy` path (or make
the fleet deployment preserve its equivalent settings). Before acceptance,
require the active serving revision—not only the desired template—to show:

1. the exact candidate image;
2. `minReplicas: 1` and `maxReplicas: 1`;
3. the product Azure Files volume mounted at `/data`;
4. one active revision and one running replica;
5. three live boundary cycles of exactly 40 allowed reads + 1 limited read and
   12 allowed writes + limited writes, all 429s carrying `Retry-After: 1`;
6. a real test booking surviving a revision replacement.

No product code was modified during this verification.
