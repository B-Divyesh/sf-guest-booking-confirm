# Copy audit

Date: 2026-08-30 UTC

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
