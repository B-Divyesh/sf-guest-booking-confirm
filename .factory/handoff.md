# Guest Booking Confirm — editorial landing page handoff

Date: 2026-08-29

## Outcome

The public unconfigured state now recreates the supplied editorial scheduling
reference as a responsive production page. The Rust/axum backend, SQLite data
model, demo sandbox, guest booking trail, owner approval flow, Entra identity,
billing, privacy pages, and container deployment class remain intact.

## What changed

- Rebuilt the landing page around the requested pale cream, near-black,
  orange-red, muted olive, and yellow palette.
- Added the outlined wordmark, Schedule/Guide/Request booking navigation, round
  waitlist email action, oversized mixed sans/serif headline, overlapping May
  calendar collage, three-column fact bar, angular cutoff band, four-day release
  block, static marquee strips, month rows, guide, product facts, and final CTA.
- Made every public control functional. Review availability uses a real anchor;
  date chips are keyboard buttons with announced selected state; demo, owner,
  legal, and waitlist links reach real destinations.
- Generated a text-free risograph calendar texture with the factory image tool.
  The 2.3 MB source and prompt sidecar live in `assets/src/`. A 73 KB WebP and
  4 KB paper-grain crop ship from `public/assets/`.
- Updated the design record, copy audit, theme color, static 404 header, and
  service-worker precache.
- Added the `eight-week-release-board` claim and an exact 390 px regression for
  the copy, schedule anchor, interactive pending state, 44 px navigation
  targets, and 200% text reflow.
- Extended the generated-artwork provenance test to cover both new derivatives.

## Verification

- `npm test` — PASS: 4 Vitest tests, 20 Rust tests, claims registry, and 4
  deployment contract tests.
- `npm run check` — PASS: TypeScript and Clippy with warnings denied.
- `cargo fmt --all -- --check` — PASS.
- `npm run build` — PASS; `dist/` produced. Main JS is 48,873 bytes raw / 15.00
  KB gzip; CSS is 36,545 bytes raw / 8.36 KB gzip. Owner auth remains lazy.
- `npm run test:e2e` — PASS, 22/22 on desktop and mobile Chromium. A later
  repeat reached 21/22 before Chromium itself segfaulted while launching the
  last mobile context; that exact offline test then passed alone, 1/1.
- Browser coverage includes the new interactive board, 390 px layout, 200%
  text, keyboard flow, focus, axe, offline reload, demo privacy, and every
  existing booking/owner workflow.
- `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4173/ ...` — PASS with one
  `h1`, `lang=en`, a main landmark, complete image alt handling, and no console
  errors. Screenshots and JSON are in
  `.factory/qa-artifacts/reference-build-home/`.
- Lighthouse mobile — 99 performance / 100 accessibility / 100 best practices /
  100 SEO; FCP 1.4 s, LCP 2.0 s, TBT 80 ms, CLS 0. Evidence:
  `.factory/qa-artifacts/reference-build-lighthouse.json`.
- `npm audit --omit=dev` — PASS, zero vulnerabilities.

## Known gaps

No product blocker is known. The May, July, and December 2025 dates are an
interactive sample release board, not the configured owner’s live availability;
the real booking form continues to use the owner’s stored hours and timezone.
