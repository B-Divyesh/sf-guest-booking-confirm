# Adversarial first-read review 3 — Guest Booking Confirm

Date: 2026-09-02 UTC
Work order: `guest-booking-confirm-review-3`
Live URL: <https://guest-booking-confirm.sociobot.in>
Reviewed checkout: `a841cdfb0d25c921692b3453191824df08442298`

## Verdict: PASS

No blocking, major, or minor findings remain. All 27 registered claim commands passed separately from a fresh clone. No claim-like landing-page or README sentence lacks a matching `.factory/claims.json` entry. This is a PASS rather than a provisional acceptance: the demo, privacy boundary, prior findings, routing, copy, links, and accessibility checks below were rerun.

## Cold first read

Fresh Chromium contexts at 390 × 844 and 1440 × 900 opened `/` with no stored state and no scrolling.

- **What it does:** lets a guest request an appointment, then lets the owner approve it before the guest confirms.
- **For whom:** microbusinesses that approve guest time requests.
- **First click:** **Try it with sample data**. The adjacent explanation says, **“Opens Maya’s approved request at the guest confirmation step.”**

The first screen supplies each answer in the headline, audience sentence, and primary action. All three factual lines—**“No tracking cookies,” “The demo works offline after the first visit,”** and **“Free for 30 active bookings”**—were visible in the 390px viewport. The editorial calendar composition is distinct from a generic SaaS template and matches the documented cream/ink/orange/olive date-board direction.

## Copy audit

Counts treat a URL, code literal, price, and hyphenated term as one word. Dynamic dates and repeated date controls are interface values; their status patterns are listed once. No entry exceeds 22 words. No banned marketing term, unexplained mood heading, inconsistent booking term, or non-result-naming action was found.

### Landing page sentences, headings, and meaningful labels

| Copy | Words | Result |
| --- | ---: | --- |
| Guest booking for microbusinesses | 4 | Pass |
| Request and confirm guest appointments. | 5 | Pass |
| For microbusinesses that approve time requests before each guest gets a clear booking status. | 14 | Pass |
| Try it with sample data | 5 | Pass |
| Opens Maya’s approved request at the guest confirmation step. | 9 | Pass |
| Review sample appointment statuses | 4 | Pass |
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
| Select a future sample date to hear its booking status. | 10 | Pass |
| Requested — Sample appointments | 3 | Pass |
| Waiting for owner approval | 4 | Pass |
| Approved — Sample appointments | 3 | Pass |
| Ready for guest confirmation | 4 | Pass |
| Confirmed — Sample appointments | 3 | Pass |
| Confirmed by the guest | 4 | Pass |
| Friday, September 4, 2026 is waiting for owner approval. | 9 | Pass; generated future sample value at review time |
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

Navigation and actions—**Try the demo**, **Owner panel**, **Privacy**, **Try it with sample data**, **Review sample appointment statuses**, **Read the privacy policy**, **Read the terms**, and **Open the owner panel**—all name their destinations or result. `Privacy` and `Terms` are direct destination labels. The twelve date controls consistently use `requested`, `approved`, and `confirmed` states.

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
| Factory releases give the app a managed `/data` volume and one running replica. | 13 | Pass |
| The repository does not create production storage. | 7 | Pass |
| `npm run deploy` requires `deploy.data_dir: /data`. | 6 | Pass |
| It checks the live build, mounted data, one replica, and each rate limit three times. | 15 | Pass |
| `/privacy` and `/terms` describe retention and use. | 7 | Pass |
| Panel Pro checkout and verification use `https://api.sociobot.in/api/v1/products/guest-booking-confirm/...`; no payment provider is embedded. | 12 | Pass |
| The opportunity brief is in `.factory/brief.json`. | 6 | Pass |
| See `.factory/design.md` for the visual system. | 6 | Pass |
| Release verification is in `.factory/handoff.md`. | 5 | Pass |

README headings—**Try the sample desk**, **Who it is for**, **Run locally**, **Test and build**, and **Privacy and billing**—name their sections. Commands are not prose sentences. Terminology is consistent: a `guest` makes a `time request` for an `appointment`; an `owner` approves it; a `private booking link` gives the guest its state; the isolated try-out is the `demo`.

## Demo and sandbox

The one-click demo passes.

- `/?demo=1` and the first-screen action opened a working guest view in one click. The initial view showed Maya Chen, Northstar Barber, Precision cut, reference `DEMO-482`, a future 45-minute time, and **Ready to confirm**.
- The persistent banner read **“Demo — sample data, nothing is saved”** and included **Reset demo** and **Start for real**.
- Reset restored the approved sample. Start for real removed the demo key and returned to `/`.
- The fresh-context request log during the complete demo entry/reset/exit check contained only same-origin document and static-asset requests. It made no booking API request and set no cookie.
- Storage contained only `demo:guest-booking-confirm:state`; no real namespace was read or written. The demo cannot reach the SQLite desk while the banner is present.
- The registered offline claim separately confirmed an offline reload after the first visit with the ready-to-confirm sample still usable.

## Claims

Every `.factory/claims.json` command ran separately after `npm ci` in fresh clone `/tmp/gbc-review3-kFqnoE/clone`. Result: **27/27 passed**.

| Claim ID | Result |
| --- | --- |
| demo-confirmation-trail | Pass |
| appointment-status-preview | Pass |
| demo-local-only | Pass |
| offline-reload | Pass |
| no-tracking-cookies | Pass |
| anonymous-page-view-count | Pass |
| service-storage-inventory | Pass |
| guest-no-account | Pass |
| owner-approval-before-booking | Pass |
| copy-private-booking-link | Pass |
| private-booking-link-security | Pass |
| guest-rescheduling | Pass |
| guest-cancellation | Pass |
| confirmed-calendar-ics | Pass |
| manual-reminder-checklist | Pass |
| free-desk-capacity-and-retention | Pass |
| panel-pro-capacity-and-retention | Pass |
| panel-pro-checkout | Pass |
| browser-license-storage | Pass |
| revoked-license-fallback | Pass |
| generated-artwork-provenance | Pass |
| api-rate-limit | Pass |
| health-build-identity | Pass |
| owner-entra-identity | Pass |
| first-owner-setup | Pass |
| fleet-managed-release | Pass |
| container-runtime-contract | Pass |

The live landing page and README were cross-checked against this registry. All observable promises have an applicable registered claim, including the demo boundary, no-account flow, storage inventory, price/retention, privacy, offline behavior, owner approval, calendar export, private links, rate limits, billing, deployment, and artwork provenance.

## Earlier findings and history

Read: `review-1.md`, `review-2.md`, `polish-1.md`, `polish-2.md`, and the previous handoff. Each prior finding was confirmed on the live site and in current source/tests, rather than relying on its `Fixed` label.

| Earlier finding | Current result |
| --- | --- |
| F-1-1 | Fixed: future sample appointments show real requested, approved, and confirmed states. |
| F-1-2 | Fixed: unsupported eight-week behavior and its copy-only claim are absent. |
| F-1-3 | Fixed: all three facts are inside the 390px first screen. |
| F-1-4 | Fixed: no false waitlist action remains. |
| F-1-5 | Fixed: the demo navigation names and opens the demo. |
| F-1-6 | Fixed: storage copy is complete and the inventory claim passes. |
| F-1-7 | Fixed: valid private pages have their own metadata; common routes are also correct. |
| F-1-8 | Fixed: the designed 404 includes metadata and icons. |
| F-1-9 | Fixed: unsupported self-hosting copy is absent. |
| F-1-10 | Fixed: copying the exact private link is registered and tested. |
| F-1-11 | Fixed: first-owner exclusivity is registered and tested. |
| F-1-12 | Fixed: private-link wording is plain and the security behavior is tested. |
| F-1-13 | Fixed: the broad no-environment promise is absent. |
| F-1-14 | Fixed: health/build identity is registered and tested. |
| F-1-15 | Fixed: `/manage` is in the sitemap; private and 404 routes are noindex. |
| F-1-16 | Fixed: “Spring preview” is absent. |
| F-1-17 | Fixed: “Decision point” is absent. |
| F-1-18 | Fixed: the status heading is specific. |
| F-1-19 | Fixed: “Next up” is absent. |
| F-1-20 | Fixed: the schedule heading names future sample appointments. |
| F-1-21 | Fixed: undefined “locked” status is absent. |
| F-1-22 | Fixed: the status rail uses request, approval, confirmation, and private-link terms. |
| F-1-23 | Fixed: stale 2025 release copy is absent. |
| F-1-24 | Fixed: the review action names sample appointment statuses. |
| F-1-25 | Fixed: “Simple by design” is absent. |
| F-1-26 | Fixed: the storage heading names its section. |
| F-1-27 | Fixed: the limitations heading names its section. |
| F-1-28 | Fixed: the price heading names its section. |
| F-1-29 | Fixed: the final demo heading names the sample booking flow. |
| F-1-30 | Fixed: deployment prose is short and avoids internal template/topology jargon. |
| F-1-31 | Fixed: the README names mounted data and one replica. |
| F-1-32 | Fixed: the formerly overlong README sentence remains split. |
| F-2-1 | Fixed: fleet-managed release behavior is registered as `fleet-managed-release` and passes. |
| F-2-2 | Fixed: the sitemap uses the canonical `/?demo=1` demo URL. |

## Structure, accessibility, and links

- Live `/`, `/?demo=1`, `/demo`, `/privacy`, `/terms`, `/manage`, `/404`, and an unknown URL were checked in fresh contexts. They had appropriate per-route titles, descriptions, canonical and sharing metadata, one h1, one main landmark, and no runtime console/page error on valid routes. The unknown URL returned HTTP 404 and the designed recovery page.
- The home title follows the required product-and-purpose pattern: **Guest Booking Confirm — confirm guest appointments**. The live document has `lang=en`, canonical/OG/Twitter metadata, favicon, 180px apple touch icon, 1200 × 630 social image, restrictive CSP, `nosniff`, `DENY`, and `Referrer-Policy: same-origin` response headers.
- All discovered first-party links and support assets returned 200: home, demo, owner panel, privacy, terms, health, robots, sitemap, favicon, apple icon, and social card. The sitemap lists the indexable routes; the designed 404 and private routes are intentionally noindex.
- In-app navigation moved focus to the destination h1. Browser Back restored `/` and focused its h1 after the route completed.
- Fresh 390px Axe scans of home, demo, privacy, terms, owner panel, and designed 404 returned no violations. Keyboard and reduced-motion behavior are also exercised by the passing browser claims.

## Missed leverage

No additional AI feature is warranted. The brief’s central job is deterministic request, owner approval, confirmation, rescheduling, cancellation, calendar export, and a manual reminder record. Adding a model would add privacy/cost exposure without removing a booking task. Calendar export is present, and no import or sync is clearly implied by the brief.

## What would make this perfect

Nothing is currently missing for the stated product contract. Maintain the existing claim suite and repeat this cold-context review after any change to demo storage, routing, booking states, pricing, privacy copy, or deployment wording.
