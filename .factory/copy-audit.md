# Copy audit

Date: 2026-09-02 UTC

Counts treat hyphenated terms, route names, and prices as one word. Dynamic future dates and repeated status controls are interface values, not sentences. No item exceeds 22 words, and no banned plain-words term appears.

## Cold first screen

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

The bottom edge of the third fact is asserted inside 390 × 844 and 1440 × 900 viewports by the `@claim:appointment-status-preview` and desktop accessibility tests.

## Appointment preview

| Copy | Words | Result |
| --- | ---: | --- |
| Guest requests | 2 | Pass |
| Owner approves | 2 | Pass |
| Guest confirms | 2 | Pass |
| Track each appointment status | 4 | Pass |
| The owner approves the requested time. | 6 | Pass |
| The guest then uses one private link to confirm, change, or cancel it. | 13 | Pass |
| Sample appointments awaiting confirmation | 4 | Pass |
| These future sample dates show the step after owner approval. | 10 | Pass |
| One clear status. | 3 | Pass |
| Each guest sees what needs to happen next. | 8 | Pass |
| Review sample appointment statuses | 4 | Pass |
| Select a future sample date to hear its booking status. | 10 | Pass |
| Requested | 1 | Pass |
| Waiting for owner approval | 4 | Pass |
| Approved | 1 | Pass |
| Ready for guest confirmation | 4 | Pass |
| Confirmed | 1 | Pass |
| Confirmed by the guest | 4 | Pass |

The twelve date controls repeat a weekday, day number, and one of the three status labels. Their dates are generated after the current day and tested by `@claim:appointment-status-preview`.

## How booking works and product limits

| Copy | Words | Result |
| --- | ---: | --- |
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

## Navigation, links, and footer

| Copy | Words | Result |
| --- | ---: | --- |
| Try the demo | 3 | Pass |
| Owner panel | 2 | Pass |
| Privacy | 1 | Pass |
| Read the privacy policy | 4 | Pass |
| Read the terms | 3 | Pass |
| Open the owner panel | 4 | Pass |
| Clear appointment state, no guest account. | 6 | Pass |
| Generated artwork with recorded prompt provenance. | 6 | Pass |
| No tracking cookies. | 3 | Pass |
| Built by Param Factory. | 4 | Pass |

## Terminology

| Concept | Product term |
| --- | --- |
| A visitor booking an appointment | guest |
| A request that needs a decision | time request |
| A scheduled service | appointment |
| A selectable calendar option | available time |
| The business operator | owner |
| A small business using the booking desk | microbusiness |
| The private status URL | private booking link |
| The isolated try-out | demo |

## README

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
| Owners sign in at /manage through Sociobot Microsoft Entra External ID. | 11 | Pass |
| The first signed-in owner creates the desk settings. | 8 | Pass |
| Another identity cannot take over that desk. | 7 | Pass |
| Anyone with a private booking link can use it, so share it only with the guest. | 16 | Pass |
| Read API calls allow 40 requests and write API calls allow 12 requests per client in any rolling one-second window. | 20 | Pass |
| Later calls return `429` with `Retry-After: 1`. | 7 | Pass |
| The exempt /health endpoint stays available and returns the compiled build SHA. | 12 | Pass |
| The container contract sets UID 10001, PORT 8080, SQLite at /data, and graceful SIGTERM handling. | 14 | Pass |
| Factory releases give the app a managed /data volume and one running replica. | 13 | Pass |
| The repository does not create production storage. | 7 | Pass |
| `npm run deploy` requires `deploy.data_dir: /data`. | 6 | Pass |
| It checks the live build, mounted data, one replica, and each rate limit three times. | 15 | Pass |
| `/privacy` and `/terms` describe retention and use. | 7 | Pass |
| Panel Pro checkout and verification use `https://api.sociobot.in/api/v1/products/guest-booking-confirm/...`; no payment provider is embedded. | 12 | Pass |
| The opportunity brief is in `.factory/brief.json`. | 6 | Pass |
| See `.factory/design.md` for the visual system. | 6 | Pass |
| Release verification is in `.factory/handoff.md`. | 5 | Pass |

README code literals and URLs are counted as single terms. No README sentence exceeds 22 words or uses a banned marketing term.
