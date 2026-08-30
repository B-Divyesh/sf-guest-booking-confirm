# Adversarial first-read review 1 — Guest Booking Confirm

Date: 2026-08-30 UTC

Work order: `guest-booking-confirm-review-1`

Live URL: <https://guest-booking-confirm.sociobot.in>

Reviewed source: `4118d74985527f93571b0995a58ba48bbe59ecbe`

## Verdict: **FAIL**

There are 32 findings: 2 blocking, 12 major, and 18 minor. The demo and all 21 registered claim commands pass, but the landing page presents a past-dated “release schedule” that is not implemented by the booking product. Its claim test checks that the words exist instead of proving the promised eight-week/two-week behavior. Several other public claims are absent from `.factory/claims.json`, so the product still has untested claims.

## 1. Cold first read

Fresh Chromium contexts were opened without stored state at 390 × 844 and 1440 × 900. Nothing was scrolled before recording the following interpretation.

- What it does: lets a guest request an appointment and lets a microbusiness approve it before the guest confirms.
- For whom: microbusinesses that take guest appointments without requiring guest accounts.
- First click: **Try it with sample data**; the adjacent note says it opens Maya's approved request at the confirmation step.

All three questions are answerable from the first screen, so the mandatory first-read blocking condition is not triggered. At 390 × 844, however, the third required plain fact is below the fold; see F-1-3.

## 2. Findings

### Blocking

#### F-1-1 — The main product preview is stale and describes behavior the product does not have

- Location/quote: landing calendar collage and schedule: **“Spring preview”**, **“May 5”**, **“2025”**, **“Earliest start: 8 weeks”**, **“Dates lock two weeks before each appointment”**, **“May 5—8”**, and **“2025 release schedule.”**
- Evidence: the review date is 30 August 2026. The source hard-codes May/July/December 2025. The real booking UI requests `/api/public/slots?days=14`; no eight-week opening policy or two-week locking rule exists in the backend.
- Why this fails: the section presented as the product preview is a past “release board,” not a current appointment flow. A visitor can reasonably conclude that all desks open exactly eight weeks ahead, lock two weeks ahead, operate Monday–Thursday, and pause on holidays. Those are not product rules.
- Concrete fix: replace the whole static release board with a current, realistic appointment preview generated from future sample dates and the actual request → approval → confirmation states. Use “appointment date” and “time request” consistently. Remove the eight-week and two-week rules, or implement them as owner-configurable backend rules and enforce them on slot listing and booking creation.

#### F-1-2 — `eight-week-release-board` is an untested claim despite a passing command

- Location/quote: `.factory/claims.json`: **“The release board shows dates opened 8 weeks in advance and locked two weeks before the event.”**
- Evidence: `npm run test:e2e -- --grep @claim:eight-week-release-board` passes, but the test only asserts that “8 weeks” and “Dates lock two weeks…” are visible, clicks a hard-coded July 7 button, and checks the hard-coded word “pending.” It does not open dates eight weeks ahead, enforce a lock, or reject a request inside the cutoff.
- Why this fails: the claims contract requires observable behavior, not an assertion that claim copy exists. This claim is therefore untested, and the backend contradicts it by exposing only the next 14 days.
- Concrete fix: either delete the claim and all matching landing copy, or implement the scheduling rules and add a clean-state test that freezes time, proves the opening boundary, proves the lock boundary, and confirms that both slot listing and booking creation enforce them.

### Major

#### F-1-3 — The mobile first screen does not show all three required facts

- Location/quote: 390 × 844 first screen; **“Free for 30 active bookings”** is below the viewport after the two other facts.
- Why this fails: the required first-screen shape includes three privacy/offline/price facts. The wrapped four-link header consumes enough height to hide the third.
- Concrete fix: use a compact mobile header and reduce hero vertical spacing so all three facts are visible at 390 × 844 without scrolling. Add a viewport assertion for the bottom edge of the third fact.

#### F-1-4 — “Join waitlist” does not join a waitlist

- Location/quote: site-wide header CTA **“Join waitlist”** links to `mailto:hello@sociobot.in?...`.
- Why this fails: activating it opens an email composer; it does not confirm that the visitor joined anything. It also suggests an unavailable product while the same site offers owner sign-in and a paid license.
- Concrete fix: either implement a consented waitlist form that confirms the saved address, or rename the link **“Email about access”**. If the product is generally available, replace it with **“Open owner panel.”**

#### F-1-5 — “Request booking” navigates to a demo CTA, not a booking request

- Location/quote: header link **“Request booking”** points to `/#request-booking`, whose only action is **“Try it with sample data.”**
- Why this fails: the destination does not let the visitor request a booking, so the result does not match the link text.
- Concrete fix: rename the link **“Try the demo”**, or point it to a real business-scoped booking form and keep **“Request booking.”**

#### F-1-6 — The landing privacy sentence is both unlisted and inaccurate as written

- Location/quote: landing details: **“Real desks store only booking details and consent.”**
- Evidence: `.factory/claims.json` has no matching claim. The server also stores owner settings/identity, anonymous daily page-view counts, rate-limit records, and paid state.
- Why this fails: “only” is a data-minimization promise that a visitor may rely on, but it omits other stored data.
- Concrete fix: use **“Real desks store booking details, consent, owner settings, paid state, and an anonymous daily page-view count.”** Add a tagged claim test that inspects the clean database schema and recorded rows.

#### F-1-7 — Canonical and Open Graph metadata remain the home-page values on every SPA route

- Location/quote: `/demo`, `/privacy`, `/terms`, `/manage`, and `/404` all expose canonical `/`, OG URL `/`, and OG title **“Guest Booking Confirm — clear appointment status.”**
- Why this fails: shared links and search metadata identify the wrong route even though each route has its own title and purpose.
- Concrete fix: update canonical, description, OG, and Twitter metadata on every route. Examples: **“Demo — Guest Booking Confirm”** with canonical `/demo`; **“Privacy — Guest Booking Confirm”** with canonical `/privacy`.

#### F-1-8 — The real 404 document omits required metadata and icons

- Location: a cold request to `/not-a-real-route` correctly returns the designed `404.html` with status 404, but it has no meta description, canonical, Open Graph/Twitter data, favicon, or apple-touch icon.
- Why this fails: the designed route is visually consistent but does not meet the site's metadata/favicon contract.
- Concrete fix: add the product favicon/apple-touch icon, a plain 404 description, a canonical `/404` (or noindex plus the chosen canonical policy), and matching OG/Twitter tags to `frontend/404.html`.

#### F-1-9 — “Self-hosted” is an unlisted README claim

- Location/quote: README: **“Guest Booking Confirm is a self-hosted appointment desk…”**
- Why this fails: no claim entry names or tests an independent self-hosted installation.
- Concrete fix: add a `self-hosted-runtime` claim that builds the container, starts it with only documented inputs, and completes a booking flow, or rewrite to **“This repository contains an appointment desk…”**

#### F-1-10 — Copying the private link is an unlisted README claim

- Location/quote: README: **“Owners copy the private booking link into the channel they already use.”**
- Why this fails: the owner UI's copy result is not represented in the claims registry.
- Concrete fix: add a tagged browser test that approves a request, activates **“Copy guest link,”** and asserts the exact private URL in the clipboard; list the claim in `.factory/claims.json`.

#### F-1-11 — First-owner setup is an unlisted README claim

- Location/quote: README: **“The first signed-in owner creates the desk settings.”**
- Why this fails: `owner-entra-identity` proves the sign-in surface, but its registered claim does not cover ownership acquisition or exclusion of a second identity.
- Concrete fix: add a claim/test that starts with a clean database, lets one identity create settings, and proves a different identity cannot take over the desk.

#### F-1-12 — Bearer-link behavior is unlisted and described with jargon

- Location/quote: README: **“Guest action links are bearer links and should be shared privately.”**
- Why this fails: the security property has no claims entry, and “bearer link” is not plain language for a first-time reader.
- Concrete fix: rewrite it as **“Anyone with a private booking link can use it, so share it only with the guest.”** Add a tagged test proving that a valid link works without sign-in and that a changed or missing token does not expose the booking.

#### F-1-13 — The no-environment-variables statement is an unlisted runtime claim

- Location/quote: README: **“No environment variables are required in the container.”**
- Why this fails: `container-runtime-contract` lists defaults in its claim text but does not list this broader startup promise.
- Concrete fix: extend the registered claim to include this sentence and run the built container under an empty environment, or narrow the sentence to the exact variables/defaults that the current test proves.

#### F-1-14 — The health response statement is an unlisted API claim

- Location/quote: README: **“`/health` is exempt and returns the compiled build SHA.”**
- Why this fails: no claims entry names this observable endpoint result.
- Concrete fix: add a tagged test that exceeds another endpoint's limit, then confirms `/health` remains 200 and returns the compiled SHA; register the exact claim.

### Minor

#### F-1-15 — The sitemap does not list every real route

- Location: `public/sitemap.xml` lists `/`, `/demo`, `/privacy`, and `/terms`, but omits `/manage` and the designed `/404` route.
- Why this fails: the site-structure contract requires every route to be accounted for.
- Concrete fix: add indexable routes, and explicitly document/exclude non-indexable routes with `noindex` if `/manage` and `/404` should not appear in search.

#### F-1-16 — “Spring preview” is mood copy, not product information

- Location/quote: landing hero art: **“Spring preview.”**
- Why this fails: it could label an unrelated campaign and does not describe a booking state.
- Concrete fix: replace it with **“Sample weekday appointments”** or delete it.

#### F-1-17 — “Decision point” is a decorative label

- Location/quote: landing eyebrow: **“Decision point.”**
- Why this fails: it does not tell the reader which decision or action the section covers.
- Concrete fix: delete it; let the specific section heading carry the meaning.

#### F-1-18 — “The cutoff” does not make sense out of context

- Location/quote: landing h2: **“The cutoff.”**
- Why this fails: a heading list does not reveal what is cut off.
- Concrete fix: use **“When appointment requests close.”**

#### F-1-19 — “Next up” is a decorative label

- Location/quote: landing eyebrow: **“Next up.”**
- Why this fails: it provides no section name or usable information.
- Concrete fix: delete it or use **“Sample approved dates.”**

#### F-1-20 — “May 5—8” is a stale, context-free heading

- Location/quote: landing h2: **“May 5—8.”**
- Why this fails: it omits the year and booking state; the dates are already in the past.
- Concrete fix: generate future dates and use a heading such as **“Sample appointments awaiting confirmation.”**

#### F-1-21 — “4 days, locked.” is a fragment with unexplained terminology

- Location/quote: landing panel: **“4 days, locked.”**
- Why this fails: “locked” is not a defined booking status and conflicts with the adjacent “confirmed” dates.
- Concrete fix: use **“Four sample dates are confirmed.”** if that is the intended state.

#### F-1-22 — The “Releases” strip introduces inconsistent terminology

- Location/quote: landing strip: **“Releases · 8 weeks out · Dates lock · 2 weeks out…”**
- Why this fails: appointments are called “releases” only in this landing artwork, while the product uses appointments, dates, slots, and time requests.
- Concrete fix: delete the strip, or use one established term: **“Appointment requests open · Owner approves · Guest confirms.”**

#### F-1-23 — “2025 release schedule” is stale and uses the wrong concept

- Location/quote: landing eyebrow: **“2025 release schedule.”**
- Why this fails: it is a past year and “release” is not a booking term.
- Concrete fix: use **“Current sample appointment schedule”** with generated future dates.

#### F-1-24 — “Review the date board” uses product-internal visual lore

- Location/quote: landing h2: **“Review the date board.”**
- Why this fails: “date board” describes the art direction, not the visitor's task.
- Concrete fix: use **“Review sample appointment dates.”**

#### F-1-25 — “Simple by design” is marketing copy

- Location/quote: landing eyebrow: **“Simple by design.”**
- Why this fails: it asserts an adjective without giving the reader information.
- Concrete fix: delete it; **“How booking works”** already names the section.

#### F-1-26 — “Private by default” is a slogan rather than a section name

- Location/quote: landing detail heading: **“Private by default.”**
- Why this fails: the reader must read the paragraph to learn what is private.
- Concrete fix: use **“How booking data is stored.”**

#### F-1-27 — “Clear limits” is vague

- Location/quote: landing detail heading: **“Clear limits.”**
- Why this fails: the heading does not name the limitations.
- Concrete fix: use **“What this does not do.”**

#### F-1-28 — “Straightforward price” is an unproved marketing adjective

- Location/quote: landing detail heading: **“Straightforward price.”**
- Why this fails: “straightforward” carries no usable pricing information.
- Concrete fix: use **“Price and booking limits.”**

#### F-1-29 — “Try the full trail” is vague product lore

- Location/quote: landing CTA eyebrow: **“Try the full trail.”**
- Why this fails: “trail” is not the established name of a user action.
- Concrete fix: use **“Try the sample booking flow.”**

#### F-1-30 — “The gate” and “template” are unexplained README jargon

- Location/quote: README: **“The gate builds the exact source in ACR, then publishes that image only in a template…”**
- Why this fails: “gate” is not named, ACR is not expanded, and “template” has no referent on first read.
- Concrete fix: use two sentences: **“The deploy command builds the exact source in Azure Container Registry. It publishes one replica with `/data` mounted.”** Put the exact `minReplicas=maxReplicas=1` detail in the following technical line.

#### F-1-31 — “Topology” is unexplained README jargon

- Location/quote: README: **“It checks the topology and mount again as the final deployment action.”**
- Why this fails: the sentence does not say what state is checked.
- Concrete fix: use **“Before finishing, the deploy command confirms that one replica is running and `/data` is mounted.”**

#### F-1-32 — One README sentence exceeds 22 words

- Location/quote: the final README sentence beginning **“The researched scope is in…”** has 25 words.
- Why this fails: it crosses the plain-words hard cap and combines three destinations.
- Concrete fix: **“The opportunity brief is in `.factory/brief.json`. See `.factory/design.md` for the visual system and `.factory/handoff.md` for release verification.”**

## 3. Copy audit

Word counts treat hyphenated compounds and route/code tokens as one word. No banned plain-words term appears. Results marked with an ID require the rewrite in that finding.

### Landing page sentences, headings, and meaningful labels

| Copy | Words | Result |
| --- | ---: | --- |
| Guest booking for microbusinesses | 4 | Pass |
| Request and confirm guest appointments. | 5 | Pass |
| For microbusinesses that approve time requests before each guest gets a clear booking status. | 14 | Pass |
| Opens Maya’s approved request at the guest confirmation step. | 9 | Pass |
| No tracking cookies | 3 | Pass |
| The demo works offline after the first visit | 8 | Pass |
| Free for 30 active bookings | 5 | F-1-3 (placement) |
| Available | 1 | Pass |
| Spring preview | 2 | F-1-16 |
| Weekday slots | 2 | Pass |
| Mon May 5 Confirmed | 4 | F-1-1 |
| Earliest start: 8 weeks | 4 | F-1-1, F-1-2 |
| Working days: Mon—Thu | 4 | F-1-1 |
| Pause dates: Holidays | 3 | F-1-1 |
| Decision point | 2 | F-1-17 |
| The cutoff | 2 | F-1-18 |
| Dates lock two weeks before each appointment. | 7 | F-1-1, F-1-2 |
| The owner confirms the time or suggests another one before then. | 11 | Pass |
| Next up | 2 | F-1-19 |
| May 5—8 | 3 | F-1-20 |
| Four weekday dates move together from open request to owner approval. | 11 | F-1-1 |
| 4 days, locked. | 3 | F-1-21 |
| Guests see one clear status for every requested time. | 9 | Pass |
| Releases · 8 weeks out · Dates lock · 2 weeks out… | 9 | F-1-22 |
| 2025 release schedule | 3 | F-1-23 |
| Review the date board | 4 | F-1-24 |
| Select a date to hear its current sample status. | 9 | Pass |
| Monday, May 5 is confirmed in this sample schedule. | 9 | F-1-1 |
| Simple by design | 3 | F-1-25 |
| How booking works | 3 | Pass |
| Request a time | 3 | Pass |
| The guest chooses an available time and shares only needed contact details. | 12 | Pass |
| Owner approves | 2 | Pass |
| The owner approves the request before the appointment becomes ready to confirm. | 12 | Pass |
| Guest confirms | 2 | Pass |
| A private link keeps confirmation, changes, calendar export, and cancellation together. | 11 | Pass |
| Guests request · Owners approve · Guests confirm · One private link… | 9 | Pass; decorative repetition only |
| Private by default | 3 | F-1-26 |
| Demo data stays in this browser. | 6 | Pass |
| Real desks store only booking details and consent. | 8 | F-1-6 |
| Clear limits | 2 | F-1-27 |
| This is not a payment system, staff rota, CRM, or automatic message sender. | 13 | Pass |
| Straightforward price | 2 | F-1-28 |
| The free desk holds 30 active bookings. | 7 | Pass |
| Panel Pro is a $29 one-time license. | 7 | Pass |
| Try the full trail | 4 | F-1-29 |
| Request. Approve. Confirm. | 3 | Pass |
| Opens a ready-to-confirm sample. | 4 | Pass |
| Nothing is saved to a real desk. | 7 | Pass |
| Clear appointment state, no guest account. | 6 | Pass |
| Generated artwork with recorded prompt provenance. | 6 | Pass |
| No tracking cookies. | 3 | Pass; repeated claim |
| Built by Param Factory. | 4 | Pass |

The twelve generated date controls repeat the short tokens `Mon/Tue/Wed/Thu`, day number, and `confirmed/pending/paused`; they are interface values rather than sentences. Their stale dates and unsupported states are covered by F-1-1.

### Landing action and navigation labels

| Label | Result |
| --- | --- |
| Schedule | Pass: destination link |
| Guide | Pass: destination link |
| Request booking | F-1-5: destination does not provide that result |
| Join waitlist | F-1-4: opens email instead of joining |
| Try it with sample data | Pass |
| Review sample availability | Pass |
| Read the privacy policy | Pass |
| Read the terms | Pass |
| Open the owner panel | Pass |
| build ID / Owner panel / Privacy / Terms | Pass: destination links |

### README sentences

| Sentence | Words | Result |
| --- | ---: | --- |
| Guest Booking Confirm is a self-hosted appointment desk for businesses whose guests should not need accounts. | 16 | F-1-9 |
| A guest requests a time and the owner approves it. | 10 | Pass |
| A private link then supports confirmation, rescheduling, cancellation, calendar download, and the owner’s manual reminder checklist. | 16 | Pass |
| It is deliberately not a staff rota, payment system, CRM, or automatic email/SMS sender. | 14 | Pass |
| Owners copy the private booking link into the channel they already use. | 12 | F-1-10 |
| Live: https://guest-booking-confirm.sociobot.in | 2 | Pass |
| Open https://guest-booking-confirm.sociobot.in/demo or select Try it with sample data on the first screen. | 13 | Pass |
| It opens Maya Chen’s already-approved sample appointment, ready for the guest confirmation step. | 13 | Pass |
| The demo is isolated in a `demo:` localStorage key; it never calls the booking API or writes to a real owner desk. | 22 | Pass |
| Reset it from the persistent demo banner, or choose Start for real to discard the sample. | 16 | Pass |
| Sole traders and microbusinesses offering one appointment service from one calendar. | 11 | Pass |
| The free desk allows 30 active future bookings and deletes closed records after 30 days. | 15 | Pass |
| The optional $29 one-time Panel Pro license unlocks unlimited active bookings and 365-day closed-record retention through the Sociobot billing API. | 20 | Pass |
| Requirements: Node 22+, Rust 1.88+, and SQLite build support. | 9 | Pass |
| `npm run dev` starts Vite and the Rust service. | 9 | Pass |
| It creates `data/dev.db`; open `http://localhost:5173`. | 5 | Pass |
| No environment variables are required in the container. | 8 | F-1-13 |
| For a direct Rust run, the defaults are `PORT=8080` and `DATABASE_URL=sqlite:/data/guest-booking-confirm.db`; override the database path for local write access. | 20 | Pass |
| Owners sign in at `/manage` through Sociobot Microsoft Entra External ID. | 11 | Pass |
| The first signed-in owner creates the desk settings. | 8 | F-1-11 |
| Guest action links are bearer links and should be shared privately. | 11 | F-1-12 |
| Read API calls allow 40 requests and write API calls allow 12 requests per client in any rolling one-second window. | 20 | Pass |
| Later calls return `429` with `Retry-After: 1`. | 7 | Pass |
| `/health` is exempt and returns the compiled build SHA. | 9 | F-1-14 |
| The container contract sets UID 10001, `PORT=8080`, SQLite on a persistent Azure Files volume at `/data`, and one serving replica. | 20 | Pass |
| It handles `SIGTERM` for a graceful shutdown. | 7 | Pass |
| Factory releases must use `npm run deploy`. | 7 | Pass |
| The gate builds the exact source in ACR, then publishes that image only in a template that already includes `/data` and `minReplicas=maxReplicas=1`. | 22 | F-1-30 |
| It proves the live build identity plus the 40-read, 12-page-view, and 12-license-check limits three times. | 15 | Pass |
| It checks the topology and mount again as the final deployment action. | 12 | F-1-31 |
| A release fails if any check does not pass. | 9 | Pass |
| `/privacy` and `/terms` describe retention and use. | 7 | Pass |
| Panel Pro checkout and verification use the Sociobot endpoint; no payment provider is embedded. | 12 | Pass |
| The researched scope is in `.factory/brief.json`, the product-specific visual system and generated-asset provenance are in `.factory/design.md`, and release verification is in `.factory/handoff.md`. | 25 | F-1-32 |

README headings — **Try the sample desk**, **Who it is for**, **Run locally**, **Test and build**, and **Privacy and billing** — name their sections and pass the out-of-context check. Shell commands are not prose sentences and are excluded from sentence counts.

### Terminology check

| Concept | Terms observed | Result |
| --- | --- | --- |
| Appointment | appointment, booking | Acceptable distinction: appointment is the event; booking is the record/flow |
| Requested time | time request, request | Pass |
| Available time | slot, date | Pass in working UI |
| Landing schedule | release, release date, date board, locked | F-1-1, F-1-21 through F-1-24: inconsistent with the product |
| Business operator | owner | Pass |
| Visitor booking | guest | Pass |
| Private URL | private booking link, guest action link, bearer link | F-1-12: use “private booking link” throughout |
| Sample mode | demo, sample data | Pass |

## 4. Demo and sandbox

The one-click demo requirement passes.

- The first landing action opens `/demo` directly.
- The first demo screen already shows Maya Chen, Northstar Barber, Precision cut, a future time, reference `DEMO-482`, and the approved/ready-to-confirm state.
- The persistent banner reads **“Demo — sample data, nothing is saved”** and includes **Reset demo** and **Start for real**.
- Confirming changes the page to **Confirmed** and exposes the sample ICS download.
- **Reset demo** restores **Ready to confirm**.
- The entire live flow makes no `/api` request, sets no cookie, and writes only `demo:guest-booking-confirm:state`.
- A fresh context has no sample state, confirming separation from other browser storage. **Start for real** removes the demo key.
- After one controlled visit, live `/demo` reloads offline with the sample and banner intact.
- The Playwright request log contains only `https://guest-booking-confirm.sociobot.in`; no third-party request occurs.

## 5. Claims execution

All entries were run individually from a clean local clone at `/tmp/gbc-review-1-Yp3Sjc` after `npm ci`. These command results are mechanically passing. F-1-2 records why one passing command does not prove its claim.

| Claim ID | Exact command | Result |
| --- | --- | --- |
| demo-confirmation-trail | `npm run test:e2e -- --grep @claim:demo-confirmation-trail` | PASS |
| eight-week-release-board | `npm run test:e2e -- --grep @claim:eight-week-release-board` | PASS command; claim unproved (F-1-2) |
| demo-local-only | `npm run test:e2e -- --grep @claim:demo-local-only` | PASS |
| offline-reload | `npm run test:e2e -- --grep @claim:offline-reload` | PASS |
| no-tracking-cookies | `npm run test:e2e -- --grep @claim:no-tracking-cookies` | PASS |
| anonymous-page-view-count | `cargo test --locked claim_anonymous_page_view_count` | PASS |
| guest-no-account | `npm run test:e2e -- --grep @claim:guest-no-account` | PASS |
| owner-approval-before-booking | `npm run test:e2e -- --grep @claim:owner-approval-before-booking` | PASS |
| guest-rescheduling | `npm run test:e2e -- --grep @claim:guest-rescheduling` | PASS |
| guest-cancellation | `npm run test:e2e -- --grep @claim:guest-cancellation` | PASS |
| confirmed-calendar-ics | `npm run test:e2e -- --grep @claim:confirmed-calendar-ics` | PASS |
| manual-reminder-checklist | `npm run test:e2e -- --grep @claim:manual-reminder-checklist` | PASS |
| free-desk-capacity-and-retention | `cargo test --locked claim_free_desk_capacity_and_retention` | PASS |
| panel-pro-capacity-and-retention | `cargo test --locked claim_panel_pro_capacity_and_retention` | PASS |
| panel-pro-checkout | `npm run test:billing` | PASS |
| browser-license-storage | `npm run test:e2e -- --grep @claim:browser-license-storage` | PASS |
| revoked-license-fallback | `cargo test --locked claim_revoked_license_returns_to_free_limits_and_keeps_export` | PASS |
| generated-artwork-provenance | `cargo test --locked claim_generated_artwork_provenance` | PASS |
| api-rate-limit | `npm run test:e2e -- --grep @claim:api-rate-limit` | PASS |
| owner-entra-identity | `npm run test:e2e -- --grep @claim:owner-entra-identity` | PASS |
| container-runtime-contract | `cargo test --locked claim_container_runtime_contract` | PASS |

Unlisted claim findings are F-1-6 and F-1-9 through F-1-14. No other landing/README claim lacks a reasonable matching registry entry.

## 6. Structure, accessibility, links, and visual identity

- Titles pass on `/`, `/demo`, `/privacy`, `/terms`, `/manage`, `/404`, and the true 404. Each page has one h1, one main landmark, and `lang="en"`.
- Deep links load the intended state. In-app navigation focuses the new h1; browser Back returns to `/` and focuses its h1.
- The true unknown route returns HTTP 404 and a designed way back. Its missing metadata is F-1-8.
- All discovered same-origin links return 200; the only non-HTTP link is the explicit `mailto:` waitlist action. `robots.txt`, `sitemap.xml`, favicon, apple-touch icon, social card, and `/health` return 200.
- The live factory `verify-url.sh` passes: no load console errors, one h1/main, title/lang present, no missing image alt, and no unlabeled button.
- Live Playwright axe scans report zero serious/critical violations on `/`, `/demo`, `/privacy`, `/terms`, `/manage`, and the true 404 at 390 px.
- Keyboard focus, Back navigation focus, reduced motion, 200% text reflow, and 44 px demo controls are covered by the passing browser suite.
- The social image is 1200 × 630; the apple-touch icon is 180 × 180. Main first-load JS is 49.01 kB raw / 15.03 kB gzip; the 260.12 kB auth module is lazy-loaded on owner access.
- The editorial paper/date-board palette, typography, angular panels, grain, and signal lamps are visually distinct from a generic SaaS template. The defect is the stale/unsupported content of the board, not a lack of visual identity.

## 7. History

There are no earlier `.factory/review-*.md` or `.factory/polish-*.md` files. The existing `.factory/handoff.md` claimed no known gaps and cited a passing verification-14 run. Its build, demo, privacy, accessibility, and registered-test statements were independently reconfirmed where applicable. Its “no product-scope gaps” conclusion is not confirmed because F-1-1, F-1-2, and the unlisted claims remain in the live site and source. There are no earlier finding IDs to carry forward.

## 8. Quality gates rerun

- `npm test` — PASS: 4 Vitest tests, 20 Rust tests, claim-registry contract, and 5 deployment/release tests.
- `npm run build` — PASS; `dist/` produced.
- Every registered claim command — PASS individually, subject to the semantic test defect in F-1-2.
- Live demo/offline/request-log audit — PASS.
- Factory live URL verifier — PASS.
- Live axe serious/critical scan — PASS with zero findings.
- Internal link/status crawl — PASS, with the sitemap completeness issue in F-1-15.

## 9. Missed leverage

No additional AI feature is justified. The brief explicitly excludes automated SMS, and the core work is deterministic booking state. ICS export already provides the expected calendar handoff. No import, sync, or AI feature is an obvious missing requirement after the findings above are fixed.

## What would make this perfect

Resolve every finding above: replace the stale release board with a current product-faithful preview, remove or implement the unsupported scheduling policy, register and behaviorally test every public claim, make mobile first-screen facts complete, correct action destinations and route metadata, and replace every flagged slogan/jargon line. Then rerun the same clean-clone claim list, live request-log/offline checks, metadata/link crawl, 390 px first-read capture, and copy audit. There is no justified stretch feature beyond that work.
