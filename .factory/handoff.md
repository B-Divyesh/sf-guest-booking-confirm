# Guest Booking Confirm — polish 1 handoff

Date: 2026-08-30 UTC

Work order: `guest-booking-confirm-polish-1`

Live URL: <https://guest-booking-confirm.sociobot.in>

## Outcome

All 32 findings in `.factory/review-1.md` are resolved. The unsupported 2025 release board and its copy-only claim are gone. The landing page now uses future sample appointments and the product’s real request, approval, and confirmation states. Its editorial date-board identity, palette, type, paper texture, angular slips, and motion policy remain intact.

The first screen states the job, audience, demo result, privacy fact, offline fact, and free limit. All required information fits inside both 390 × 844 and 1440 × 900 without scrolling. `/?demo=1` opens the isolated sample in one click, writes only `demo:guest-booking-confirm:state`, calls no API, and keeps Reset demo and Start for real visible.

Route titles, descriptions, canonicals, Open Graph/Twitter data, focus movement, noindex rules, sitemap coverage, legal links, and the true 404 document are complete. README claims now use plain words and each retained product promise has an executable claim entry.

## Verification

Clean clone: `/tmp/gbc-claims-f7wjUE` from repair commit `574b478`.

- All 26 `.factory/claims.json` commands passed individually. This included the live Sociobot $29 checkout registration and hosted checkout redirect.
- `npm test`: 4 Vitest, 21 Rust, 1 claims-contract, and 5 deployment/release tests passed.
- `npm run check`: TypeScript and clippy with warnings denied passed.
- `npm run build`: produced `dist/`; initial app JS was 15.50 KB gzip and CSS was 8.49 KB gzip.
- `npm run test:e2e`: all 23 desktop/mobile Chromium tests passed.
- Browser coverage included one-click demo/reset/exit, real guest request → owner approval → guest confirmation, clipboard link copying, changed/missing token denial, ICS download, reschedule, cancel, reminders, billing fallback, keyboard use, 200% text, Back/focus behavior, metadata, 404, privacy request logging, and offline reload.
- Axe via Playwright found zero serious or critical findings on landing, demo, privacy, terms, owner, configured guest, and 404 states.
- Lighthouse mobile: performance 99, accessibility 100, best practices 100, SEO 100; LCP 1.975 s, CLS 0, TBT 78 ms. Raw report: `.factory/qa-artifacts/polish-1-lighthouse-local.json`.
- A process started under `env -i` with only `PATH` and `PORT`, created/used the default `/data` database, returned `200` from `/health`, served the page, and shut down cleanly.
- Production deployment ran through `npm run deploy`, which builds in Azure Container Registry, applies the persistent single-replica template, checks the live build identity, probes read/write limits three times, and rechecks the `/data` mount and replica count.
- Cold production Chromium checks passed at 390 × 844 and 1440 × 900. They rechecked every review item, route metadata, navigation, demo isolation/reset/exit, no console/page errors, and zero serious/critical axe findings.

## Evidence

- Finding-by-finding map: `.factory/polish-1.md`
- Claims registry: `.factory/claims.json`
- Demo contract: `.factory/demo.md`
- Copy audit: `.factory/copy-audit.md`
- Local screenshots: `.factory/qa-artifacts/polish-1-local-desktop.png`, `polish-1-local-mobile-390.png`, `polish-1-local-demo-390.png`
- Live screenshots: `.factory/qa-artifacts/polish-1-live-desktop.png`, `polish-1-live-mobile-390.png`, `polish-1-live-demo-390.png`

## Run and verify

```sh
npm ci
npm test
npm run check
npm run build
npm run test:e2e
npm run test:billing
npm run deploy
```

## Known gaps and next steps

None for this work order. All findings, including minor copy findings, are closed and covered by evidence.
