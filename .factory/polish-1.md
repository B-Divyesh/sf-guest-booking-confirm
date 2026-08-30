# Perfection-loop polish 1

Date: 2026-08-30 UTC

Work order: `guest-booking-confirm-polish-1`

Release candidate repaired: `4f94d2e4f376b7a4440700f746a6313a09e3b92b`

Review source: `cc7f046498ae868add1943c83aa6d1c3f1606010` / `.factory/review-1.md`

## Finding closure

Every finding is closed. Browser evidence is in `.factory/qa-artifacts/polish-1-local-desktop.png`, `.factory/qa-artifacts/polish-1-local-mobile-390.png`, `.factory/qa-artifacts/polish-1-local-demo-390.png`, and the matching `polish-1-live-*.png` captures. The final live checks used <https://guest-booking-confirm.sociobot.in> and <https://guest-booking-confirm.sociobot.in/?demo=1> in fresh Chromium contexts.

| Finding | Change made | Evidence |
| --- | --- | --- |
| F-1-1 | Replaced every hard-coded 2025 release date and invented opening/locking rule with generated future appointment dates and the real requested → approved → confirmed states. | `@claim:appointment-status-preview`; local/live desktop and 390px landing captures; cold live `/` check. |
| F-1-2 | Deleted `eight-week-release-board` and its copy-only test. Registered `appointment-status-preview`, which asserts 12 future dates and exercises all three observable states. | `.factory/claims.json`; `npm run test:e2e -- --grep @claim:appointment-status-preview` passed from the clean clone. |
| F-1-3 | Reduced the 390px header to three links, tightened first-screen rhythm, and added viewport-edge assertions at 390 × 844 and 1440 × 900. | `@claim:appointment-status-preview`; desktop accessibility test; `polish-1-local-mobile-390.png`; `polish-1-live-mobile-390.png`. |
| F-1-4 | Removed “Join waitlist”; the header now links to the available owner panel. | Desktop navigation assertion checks exact labels/hrefs and absence of `mailto:`; live header crawl. |
| F-1-5 | Removed the false “Request booking” navigation; the real destination is now “Try the demo” → `/?demo=1`. | Desktop navigation assertion; `@claim:demo-confirmation-trail`; cold live click check. |
| F-1-6 | Rewrote the storage sentence to list bookings, consent, owner settings, paid state, and anonymous daily page counts. Added a fresh-database schema/row test. | `cargo test --locked claim_service_storage_inventory`; privacy page live check. |
| F-1-7 | Added per-route title, description, canonical, Open Graph, Twitter, and robots updates for home, demo, privacy, terms, manage, guest, and 404 states. | `every route publishes its own title, canonical URL, and sharing metadata`; live route loop. |
| F-1-8 | Added description, canonical/noindex policy, OG/Twitter tags, favicon, apple-touch icon, and social image to the real 404 document. | `unknown routes return the designed 404 and hashed assets are immutable`; live unknown-path status/metadata check. |
| F-1-9 | Replaced “self-hosted” with the factual “This repository contains an appointment desk.” | README diff; `.factory/copy-audit.md`. |
| F-1-10 | Added an owner clipboard regression that creates and approves a real request, clicks “Copy guest link,” and checks the exact working URL. | `@claim:copy-private-booking-link` passed from the clean clone. |
| F-1-11 | Added a clean-database test where the first identity creates settings and a second identity is denied access and takeover. | `cargo test --locked claim_first_owner_setup_is_exclusive`. |
| F-1-12 | Replaced bearer-link jargon with plain wording and tested valid, changed, and missing tokens without owner sign-in. | `@claim:private-booking-link-security`. |
| F-1-13 | Narrowed README startup wording to the tested `PORT` and SQLite defaults; removed the unregistered broad environment claim. | `cargo test --locked claim_container_runtime_contract`; port-only empty-environment runtime smoke. |
| F-1-14 | Registered and tested health availability after rate-limit exhaustion and asserted the non-empty compiled build SHA. | `@claim:health-build-identity`; live `/health` check. |
| F-1-15 | Added `/manage` to the sitemap; the true 404 declares `noindex`, while transient callback/private-token URLs also receive dynamic `noindex`. | 404/sitemap browser assertions; live `/sitemap.xml` check. |
| F-1-16 | Replaced “Spring preview” with “Sample appointment.” | Copy audit; landing screenshots; live `/`. |
| F-1-17 | Removed “Decision point.” | Copy audit; live `/`. |
| F-1-18 | Replaced “The cutoff” with “Track each appointment status.” | Copy audit; live `/`. |
| F-1-19 | Removed “Next up.” | Copy audit; live `/`. |
| F-1-20 | Replaced the stale range with “Sample appointments awaiting confirmation” and generated future dates. | `@claim:appointment-status-preview`; live `/`. |
| F-1-21 | Replaced “4 days, locked” with “One clear status” and explanatory next-step copy. | Copy audit; live `/`. |
| F-1-22 | Replaced the release strip with consistent request, approval, confirmation, and private-link terms. | Copy audit; live `/`. |
| F-1-23 | Removed “2025 release schedule”; year and month now come from a future sample appointment. | `@claim:appointment-status-preview`; live `/`. |
| F-1-24 | Replaced “Review the date board” with “Review sample appointment statuses.” | Copy audit; live `/`. |
| F-1-25 | Removed “Simple by design.” | Copy audit; live `/`. |
| F-1-26 | Replaced “Private by default” with “How booking data is stored.” | Copy audit; live `/`. |
| F-1-27 | Replaced “Clear limits” with “What this does not do.” | Copy audit; live `/`. |
| F-1-28 | Replaced “Straightforward price” with “Price and booking limits.” | Copy audit; live `/`. |
| F-1-29 | Replaced “Try the full trail” with “Try the sample booking flow.” | Copy audit; live `/`. |
| F-1-30 | Rewrote the deploy explanation in plain sentences naming Azure Container Registry, one replica, and the `/data` mount. | README diff and copy review. |
| F-1-31 | Replaced “topology” with the exact final checks: one running replica and a mounted `/data`. | README diff and copy review. |
| F-1-32 | Split the 25-word README sentence into three short sentences. | README diff; manual word-count audit. |

## Cumulative checks

- No earlier `.factory/review-*.md` or `.factory/polish-*.md` existed beyond review 1 when work began.
- All 26 claim commands passed individually in `/tmp/gbc-claims-f7wjUE`, a clean clone of repair commit `574b478`.
- The same clean clone passed `npm test`, `npm run check`, `npm run build`, and all 23 Playwright tests.
- Playwright axe integration found zero serious or critical issues across landing, demo, legal, owner, configured guest, and 404 states.
- Lighthouse mobile: performance 99, accessibility 100, best practices 100, SEO 100, LCP 1.975 s, CLS 0, TBT 78 ms. Raw report: `.factory/qa-artifacts/polish-1-lighthouse-local.json`.
- Production build: initial app JS 15.50 KB gzip and CSS 8.49 KB gzip.
- A port-only process under `env -i` started with SQLite at `/data`, served the product, returned `/health`, and shut down cleanly on SIGINT.
- Deployment published source `7c0002b86316d02b07cb0df64a909e2b12cf97dc`, then verified one active/running replica, the Azure Files `/data` mount, and all three rate boundaries three times.
- `.factory/qa-artifacts/polish-1-live-audit.json` records clean 390 × 844 and 1440 × 900 first screens, unique metadata on every route, zero stale-copy matches, a true metadata-complete 404, all crawled links at 200, no console/page errors, no demo API calls before exit, an empty real namespace after exit, offline demo reload, and zero serious/critical axe findings.
- Live Lighthouse scored 100/100/100/100 with LCP 1.553 s, CLS 0, and TBT 27.5 ms. Raw report: `.factory/qa-artifacts/polish-1-lighthouse-live.json`.
