# Adversarial first-read review 2 — Guest Booking Confirm

Date: 2026-09-02 UTC

Work order: `guest-booking-confirm-review-2`

Live URL: <https://guest-booking-confirm.sociobot.in>

Reviewed repository: `638543d921233300df1d487f61daed047a5e6a44`

Live build: `10ad42f4b0e5b580488b00272c0462c4e6b90e79`. The repository diff from that build to the reviewed revision contains documentation only.

## Verdict: **FAIL**

Four findings remain: two blocking regressions, one major unlisted-claim finding, and one minor canonical/sitemap mismatch. The core product, demo, common live routes, accessibility checks, build, and all 26 registered claim commands pass. The private booking route still receives 404 metadata, and the README has regressed. A PASS requires zero findings.

## 1. Cold first read

Fresh Chromium contexts opened `/` at 390 × 844 and 1440 × 900. Nothing was scrolled before recording this interpretation.

- What it does: guests request and confirm appointments after a business approves the requested time.
- For whom: microbusinesses that approve guest time requests.
- First click: **Try it with sample data**. The adjacent text says, **“Opens Maya’s approved request at the guest confirmation step.”**

The exact first-screen copy **“Request and confirm guest appointments”**, **“For microbusinesses that approve time requests before each guest gets a clear booking status”**, and **“Try it with sample data”** answers all three questions. All three fact lines are fully inside both viewports. The mandatory first-read blocker does not apply.

## 2. Findings

### Blocking

#### F-1-7 — Valid private booking pages still receive 404 metadata

- Location/quote: `frontend/src/app.ts`, `updateMetadata()`. A path such as `/b/review-token` becomes route name `b/review-token`; because that key is absent from the metadata map, it falls back to **“Page not found — Guest Booking Confirm”**, description **“This page is not part of the Guest Booking Confirm appointment desk,”** and canonical `/404`.
- Evidence: a clean local browser test intercepted `/api/guest/review-token` with a valid **Ready to confirm** booking. The booking rendered, while its metadata was exactly `{"title":"Page not found — Guest Booking Confirm","description":"This page is not part of the Guest Booking Confirm appointment desk.","canonical":"https://guest-booking-confirm.sociobot.in/404","robots":"noindex,nofollow"}`. Live valid tokens could not be created because the live desk is intentionally not configured; the same shipped code is present in the live build. Polish 1 stated that guest metadata had been added, but neither its route map nor the current test suite covers `/b/<token>`.
- Why this fails: a guest opening a real private link sees a working appointment under a browser/tab title that says the page does not exist. Shared and assistive context contradicts the visible booking. This is an unfixed part of earlier metadata finding F-1-7, so it is blocking.
- Concrete fix: give `/b/<token>` its own **“Private booking — Guest Booking Confirm”** title and booking-specific description before rendering it. Keep `noindex,nofollow`; set a deliberate canonical policy that does not mislabel the page as `/404`. Add a browser regression that stubs or creates a valid booking, then asserts its title, description, canonical policy, OG/Twitter values, and robots value.

#### F-1-30 — The README deployment explanation has regressed to long, internal jargon

- Location/quote: `README.md`, deployment paragraph: **“Factory releases set `deploy.data_dir: /data`; the fleet then creates or adopts its managed `sf-guest-booking-confirm-data` share, mounts it at `/data`, and limits the app to one replica.”** (26 words); **“The product never creates storage or patches a Container App template.”**; and **“`npm run deploy` is factory-only: it requires that work-order setting, delegates deployment to the fleet, then proves the live build identity, fleet-managed `/data` mount, one active revision/replica, and each documented rate limit three times.”** (34 words).
- Evidence: review 1 raised F-1-30 for an unexplained deployment “gate,” “ACR,” and “template.” Polish 1 recorded a plain two-sentence rewrite. The current README again uses internal terms such as “fleet,” “work-order setting,” “Container App template,” and “revision/replica”; two sentences exceed the 22-word cap. The live page has no copy defect, but the current code/documentation does.
- Why this fails: a reader must decode factory implementation language to understand a run/deploy instruction, and the hard sentence-length limit is exceeded twice. This is a regression of an earlier finding, so it is blocking under the review rules.
- Concrete fix: replace the passage with: **“Factory releases give the app a managed `/data` volume and one running replica. The repository does not create production storage. `npm run deploy` requires `deploy.data_dir: /data`. It checks the live build, mounted data, one replica, and each rate limit three times.”**

### Major

#### F-2-1 — Deployment and storage promises are not listed in the claims registry

- Location/quote: the same README paragraph claims that the fleet **“creates or adopts”** the named share, that **“The product never creates storage or patches a Container App template,”** and that the deploy command proves the mount, replica, and limits three times.
- Evidence: `.factory/claims.json` has no deployment/provisioning entry. `container-runtime-contract` covers the Dockerfile/runtime contract, not fleet delegation or the prohibition on product-created storage. `api-rate-limit` covers request limits, not the other release behavior. `npm run test:deploy` passes, but no claim entry connects these public sentences to that suite.
- Why this fails: these are concrete operational and data-safety statements a self-hosting reader can rely on. Passing unregistered tests does not satisfy the claim-to-test contract.
- Concrete fix: either remove these public implementation promises, or register one exact `fleet-managed-release` claim whose test exercises `npm run test:deploy` and verifies delegation, no product-owned storage mutation, `/data`, one serving replica, and the three repeated rate checks. Update the claim-registry validator to accept that command.

### Minor

#### F-2-2 — The sitemap publishes a noncanonical demo URL

- Location/quote: `public/sitemap.xml` lists **`https://guest-booking-confirm.sociobot.in/demo`**, while both live `/demo` and `/?demo=1` declare **`https://guest-booking-confirm.sociobot.in/?demo=1`** as canonical.
- Why this fails: the sitemap tells crawlers to index an alias that the page itself says is not canonical. The two supported demo entry points are otherwise functional.
- Concrete fix: choose one public demo URL. Either list `/?demo=1` in the sitemap, or make `/demo` canonical and update the header, README, `.factory/demo.md`, and metadata test to use it.

## 3. Copy audit

Counts treat hyphenated terms, route names, prices, and code tokens as one word. Dynamic date values and repeated controls are shown once by pattern. No banned marketing word appears.

### Landing-page sentences, headings, and meaningful labels

| Copy | Words | Result |
| --- | ---: | --- |
| Guest booking for microbusinesses | 4 | Pass |
| Request and confirm guest appointments. | 5 | Pass |
| For microbusinesses that approve time requests before each guest gets a clear booking status. | 14 | Pass |
| Opens Maya’s approved request at the guest confirmation step. | 9 | Pass |
| No tracking cookies | 3 | Pass |
| The demo works offline after the first visit | 8 | Pass |
| Free for 30 active bookings | 5 | Pass |
| Sample appointment | 2 | Pass |
| Owner approved | 2 | Pass |
| Guest confirmation next | 3 | Pass |
| Ready to confirm | 3 | Pass |
| Step 1 / Guest requests | 4 | Pass |
| Step 2 / Owner approves | 4 | Pass |
| Step 3 / Guest confirms | 4 | Pass |
| Track each appointment status | 4 | Pass |
| The owner approves the requested time. | 6 | Pass |
| The guest then uses one private link to confirm, change, or cancel it. | 13 | Pass |
| 3 clear steps | 3 | Pass |
| Sample appointments awaiting confirmation | 4 | Pass |
| These future sample dates show the step after owner approval. | 10 | Pass |
| One clear status. | 3 | Pass |
| Each guest sees what needs to happen next. | 8 | Pass |
| Guests request · Owners approve · Guests confirm · One private link | 9 | Pass |
| Review sample appointment statuses | 4 | Pass |
| Select a future sample date to hear its booking status. | 10 | Pass |
| Requested — Sample appointments | 3 | Pass |
| waiting for owner approval | 4 | Pass |
| Approved — Sample appointments | 3 | Pass |
| ready for guest confirmation | 4 | Pass |
| Confirmed — Sample appointments | 3 | Pass |
| confirmed by the guest | 4 | Pass |
| Friday, September 4, 2026 is waiting for owner approval. | 9 | Pass; initial generated status on the review date |
| How booking works | 3 | Pass |
| Request a time | 3 | Pass |
| The guest chooses an available time and shares only needed contact details. | 12 | Pass |
| Owner approves | 2 | Pass |
| The owner approves the request before the appointment becomes ready to confirm. | 12 | Pass |
| Guest confirms | 2 | Pass |
| A private link keeps confirmation, changes, calendar export, and cancellation together. | 11 | Pass |
| How booking data is stored | 5 | Pass |
| Demo data stays in this browser. | 6 | Pass |
| Real desks store booking details, consent, owner settings, paid state, and an anonymous daily page-view count. | 16 | Pass |
| What this does not do | 5 | Pass |
| This is not a payment system, staff rota, CRM, or automatic message sender. | 13 | Pass |
| Price and booking limits | 4 | Pass |
| The free desk holds 30 active bookings. | 7 | Pass |
| Panel Pro is a $29 one-time license. | 7 | Pass |
| Try the sample booking flow | 5 | Pass |
| Opens a ready-to-confirm sample. | 4 | Pass |
| Nothing is saved to a real desk. | 7 | Pass |
| Clear appointment state, no guest account. | 6 | Pass |
| Generated artwork with recorded prompt provenance. | 6 | Pass |
| No tracking cookies. | 3 | Pass |
| Built by Param Factory. | 4 | Pass |

The generated schedule contains 12 date controls. Each uses a weekday, day number, and one of the listed state phrases; these are interface values rather than additional sentences.

### Landing navigation and actions

| Label | Result |
| --- | --- |
| Try the demo | Pass: names the demo destination |
| Owner panel | Pass: names the destination |
| Privacy | Pass: names the destination |
| Try it with sample data | Pass: result-naming verb |
| Review sample appointment statuses | Pass: result-naming verb |
| Read the privacy policy | Pass: result-naming verb |
| Read the terms | Pass: result-naming verb |
| Open the owner panel | Pass: result-naming verb |
| build ID / Privacy / Terms | Pass: destination links |

### README sentences

| Sentence | Words | Result |
| --- | ---: | --- |
| This repository contains an appointment desk for businesses whose guests should not need accounts. | 14 | Pass |
| A guest requests a time and the owner approves it. | 10 | Pass |
| A private link then supports confirmation, rescheduling, cancellation, calendar download, and the owner’s manual reminder checklist. | 16 | Pass |
| It is not a staff rota, payment system, CRM, or automatic email/SMS sender. | 13 | Pass |
| Owners can copy the exact private booking link to share with each guest. | 13 | Pass |
| Live: `https://guest-booking-confirm.sociobot.in` | 2 | Pass |
| Open `https://guest-booking-confirm.sociobot.in/?demo=1` or select Try it with sample data on the first screen. | 13 | Pass |
| It opens Maya Chen’s already-approved sample appointment, ready for the guest confirmation step. | 13 | Pass |
| The demo is isolated in a `demo:` localStorage key; it never calls the booking API or writes to a real owner desk. | 22 | Pass |
| Reset it from the persistent demo banner, or choose Start for real to discard the sample. | 16 | Pass |
| Sole traders and microbusinesses offering one appointment service from one calendar. | 11 | Pass |
| The free desk allows 30 active future bookings and deletes closed records after 30 days. | 15 | Pass |
| The optional $29 one-time Panel Pro license unlocks unlimited active bookings and 365-day closed-record retention through the Sociobot billing API. | 20 | Pass |
| Requirements: Node 22+, Rust 1.88+, and SQLite build support. | 9 | Pass |
| `npm run dev` starts Vite and the Rust service. | 9 | Pass |
| It creates `data/dev.db`; open `http://localhost:5173`. | 5 | Pass |
| The container defaults to `PORT=8080` and `DATABASE_URL=sqlite:/data/guest-booking-confirm.db`. | 7 | Pass |
| Override the database path for local write access. | 8 | Pass |
| Owners sign in at `/manage` through Sociobot Microsoft Entra External ID. | 11 | Pass |
| The first signed-in owner creates the desk settings. | 8 | Pass |
| Another identity cannot take over that desk. | 7 | Pass |
| Anyone with a private booking link can use it, so share it only with the guest. | 16 | Pass |
| Read API calls allow 40 requests and write API calls allow 12 requests per client in any rolling one-second window. | 20 | Pass |
| Later calls return `429` with `Retry-After: 1`. | 7 | Pass |
| The exempt `/health` endpoint stays available and returns the compiled build SHA. | 12 | Pass |
| The container contract sets UID 10001, `PORT=8080`, SQLite at `/data`, and graceful SIGTERM handling. | 14 | Pass |
| Factory releases set `deploy.data_dir: /data`; the fleet then creates or adopts its managed `sf-guest-booking-confirm-data` share, mounts it at `/data`, and limits the app to one replica. | 26 | **F-1-30, F-2-1** |
| The product never creates storage or patches a Container App template. | 11 | **F-1-30, F-2-1** |
| `npm run deploy` is factory-only: it requires that work-order setting, delegates deployment to the fleet, then proves the live build identity, fleet-managed `/data` mount, one active revision/replica, and each documented rate limit three times. | 34 | **F-1-30, F-2-1** |
| `/privacy` and `/terms` describe retention and use. | 7 | Pass |
| Panel Pro checkout and verification use `https://api.sociobot.in/api/v1/products/guest-booking-confirm/...`; no payment provider is embedded. | 12 | Pass |
| The opportunity brief is in `.factory/brief.json`. | 6 | Pass |
| See `.factory/design.md` for the visual system. | 6 | Pass |
| Release verification is in `.factory/handoff.md`. | 5 | Pass |

README headings — **Try the sample desk**, **Who it is for**, **Run locally**, **Test and build**, and **Privacy and billing** — name their sections. Fenced commands and their terse shell comments are not prose sentences.

### Terminology

| Concept | Terms used | Result |
| --- | --- | --- |
| Scheduled service and its record/flow | appointment / booking | Pass: distinct meanings |
| Requested time | time request / request | Pass |
| Selectable time | available time | Pass |
| Business operator | owner | Pass |
| Visitor | guest | Pass |
| Private URL | private booking link | Pass |
| Isolated sample mode | demo / sample data | Pass |
| Factory deployment mechanism | fleet / work-order setting / Container App template / revision/replica | **F-1-30** |

## 4. Demo and sandbox

The one-click demo itself passes.

- The first-screen action opens `/?demo=1` in one click.
- The first demo screen already shows Maya Chen, Northstar Barber, Precision cut, a future appointment, reference `DEMO-482`, and **Ready to confirm**.
- The persistent banner reads **“Demo — sample data, nothing is saved”** and provides **Reset demo** and **Start for real**.
- **Confirm this time** changes the state to **Confirmed**. **Reset demo** restores **Ready to confirm** and returns focus to the reset button.
- The demo writes only `demo:guest-booking-confirm:state`. A seeded `real:review-sentinel` key remained unchanged through confirm, reset, offline reload, and exit.
- **Start for real** removes the demo key without changing the real sentinel.
- Before exit, the request log contains only the same-origin document and three same-origin static assets. There are no `/api` or cross-origin requests and no cookies.
- After the first online visit, `/demo` reloads offline with its booking and banner intact.

## 5. Claims

Every command declared by `.factory/claims.json` ran separately in the clean clone `/tmp/gbc-review-2-vI16b1` after `npm ci`.

| Claim ID | Result |
| --- | --- |
| demo-confirmation-trail | PASS |
| appointment-status-preview | PASS |
| demo-local-only | PASS |
| offline-reload | PASS |
| no-tracking-cookies | PASS |
| anonymous-page-view-count | PASS |
| service-storage-inventory | PASS |
| guest-no-account | PASS |
| owner-approval-before-booking | PASS |
| copy-private-booking-link | PASS |
| private-booking-link-security | PASS |
| guest-rescheduling | PASS |
| guest-cancellation | PASS |
| confirmed-calendar-ics | PASS |
| manual-reminder-checklist | PASS |
| free-desk-capacity-and-retention | PASS |
| panel-pro-capacity-and-retention | PASS |
| panel-pro-checkout | PASS |
| browser-license-storage | PASS |
| revoked-license-fallback | PASS |
| generated-artwork-provenance | PASS |
| api-rate-limit | PASS |
| health-build-identity | PASS |
| owner-entra-identity | PASS |
| first-owner-setup | PASS |
| container-runtime-contract | PASS |

F-2-1 is the only claim-like landing/README content without a corresponding registry entry. No registered claim test is failing or untested.

## 6. Earlier findings

Each review-1 finding was checked against the live site and current source. Polish 1 and the current handoff were also checked; their product/demo/quality statements hold except for the copy regression below.

| Earlier ID | Result in review 2 |
| --- | --- |
| F-1-1 | Fixed: the live preview uses generated future dates and real requested, approved, and confirmed states. |
| F-1-2 | Fixed: the copy-only release-board claim is gone; the behavioral future-status claim passes. |
| F-1-3 | Fixed: all three facts end above y=505 in the 844px mobile viewport. |
| F-1-4 | Fixed: the unavailable waitlist action is gone; Owner panel is present. |
| F-1-5 | Fixed: the header action is Try the demo and opens sample data. |
| F-1-6 | Fixed: the storage inventory is complete in copy and passes its database test. |
| F-1-7 | **Still incomplete and blocking:** common routes update correctly, but valid `/b/<token>` pages receive 404 metadata. |
| F-1-8 | Fixed: a cold unknown URL returns the designed, metadata-complete 404 with icons. |
| F-1-9 | Fixed: “self-hosted” is absent. |
| F-1-10 | Fixed: the exact copied guest link is registered and tested. |
| F-1-11 | Fixed: exclusive first-owner setup is registered and tested. |
| F-1-12 | Fixed: “bearer link” is absent; private-link behavior is plain and tested. |
| F-1-13 | Fixed: the broad no-environment-variables statement is absent. |
| F-1-14 | Fixed: health/build identity is registered and tested. |
| F-1-15 | Fixed: `/manage` is in the sitemap; private and 404 routes use noindex. |
| F-1-16 | Fixed: “Spring preview” is absent. |
| F-1-17 | Fixed: “Decision point” is absent. |
| F-1-18 | Fixed: “The cutoff” is replaced by a status-specific heading. |
| F-1-19 | Fixed: “Next up” is absent. |
| F-1-20 | Fixed: the heading names future sample appointments and dates are generated. |
| F-1-21 | Fixed: the undefined “locked” state is absent. |
| F-1-22 | Fixed: the strip uses request, approval, confirmation, and private-link terms. |
| F-1-23 | Fixed: the stale 2025 release copy is absent. |
| F-1-24 | Fixed: the heading is “Review sample appointment statuses.” |
| F-1-25 | Fixed: “Simple by design” is absent. |
| F-1-26 | Fixed: the heading is “How booking data is stored.” |
| F-1-27 | Fixed: the heading is “What this does not do.” |
| F-1-28 | Fixed: the heading is “Price and booking limits.” |
| F-1-29 | Fixed: the heading is “Try the sample booking flow.” |
| F-1-30 | **Regressed and blocking:** see the finding above. |
| F-1-31 | Fixed: the README names the one-replica and mounted-data checks instead of saying only “topology.” |
| F-1-32 | Fixed: the final 25-word sentence is now three short sentences. |

## 7. Structure, accessibility, links, and identity

- `/`, `/?demo=1`, `/demo`, `/privacy`, `/terms`, `/manage`, `/404`, and a true unknown route have the expected titles, descriptions, canonical data, `lang="en"`, one h1, and one main landmark. F-1-7 records the private-booking exception. The unknown route returns HTTP 404 and `noindex`.
- The home title follows **Product — what it does** and is under 60 characters. The social image is 1200 × 630; the apple-touch icon is 180 × 180.
- In-app navigation and browser Back focus the destination h1 after its asynchronous content is ready. Reset returns focus to **Reset demo**.
- The home crawl found no dead link. `/`, `/demo`, `/privacy`, `/terms`, `/manage`, `/404`, `robots.txt`, `sitemap.xml`, both icons, the social card, and `/health` return their expected statuses. F-2-2 records the sitemap/canonical mismatch.
- The factory URL verifier reports no console/page error, one h1, a main landmark, `lang`, image alt coverage, and labeled buttons. Playwright axe reports zero serious or critical violations on every reviewed route at 390px.
- The response sends CSP, `frame-ancestors 'none'`, `X-Content-Type-Options`, and `Referrer-Policy` as headers. No third-party font or script request occurred.
- The initial built JavaScript is 16.04 KB gzip. The 65.99 KB gzip owner-auth chunk loads only on owner access.
- The editorial calendar collage, cream/ink/orange/olive palette, oversized magazine type, angular paper panels, and signal lamps match `.factory/design.md` and do not resemble a generic SaaS card/gradient template.

## 8. Quality gates

- `npm test` — PASS: 4 Vitest tests, 21 Rust tests, the claims contract, and 8 deployment/release tests.
- `npm run check` — PASS.
- `npm run build` — PASS; `dist/` produced.
- `npm run test:e2e` — PASS: 24 tests.
- Every registered claim command — PASS separately.
- Live URL verifier — PASS.
- Live axe serious/critical scan — PASS with zero violations on all reviewed routes.
- Additional valid-private-booking metadata probe — reproduces F-1-7.

## 9. Missed leverage

No additional AI feature is justified. The work is deterministic booking state, and the brief excludes automated messaging. Calendar export already supplies the obvious handoff; an AI feature would add cost and privacy exposure without removing a booking task. No additional import, export, or sync is clearly implied by the brief.

## What would make this perfect

Add correct metadata coverage for valid private booking pages. Rewrite the three deployment sentences in short, public language and either remove their operational promises or register one behavioral deployment claim. Align the sitemap with the chosen canonical demo URL. Then rerun the copy, route, and claims checks. Nothing else remains from this review.
