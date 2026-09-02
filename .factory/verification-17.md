# Independent verification 17 — PASS

Date: 2026-09-02 UTC
Candidate commit: `10ad42f4b0e5b580488b00272c0462c4e6b90e79`
Live URL: <https://guest-booking-confirm.sociobot.in>

## Result

**PASS.** The deployed health identity is exactly the candidate SHA, and the
clean-checkout, live, privacy, accessibility, rate-limit, and product-flow
checks below passed. No release-blocking defects were found.

## First-read test

Cold-opening the live landing page answers the three required questions in
plain words: it is for microbusinesses, it lets guests request appointments
that owners approve and guests confirm, and the first action is **“Try it with
sample data”**. The adjacent text says it opens Maya's approved request at the
confirmation step. The first screen also exposes the three short facts: no
tracking cookies, offline demo after first visit, and 30 free active bookings.

## Clean candidate verification

The checkout was initially clean at the candidate SHA. `npm ci` installed 85
packages with 0 vulnerabilities. The 26 entries in `.factory/claims.json` all
passed through their declared commands: the full 24-test Playwright suite
reported `test-results/.last-run.json` status `passed`; all 8 Rust claim tests
passed; and the live Sociobot `$29` checkout test passed.

Additional local gates passed:

```text
npm test                         PASS — 4 Vitest, 21 Rust, claims contract, 8 deployment tests
npm run check                    PASS — tsc --noEmit; cargo clippy -- -D warnings
cargo fmt --all -- --check       PASS
npm run build                    PASS — dist/ produced
cargo build --release --locked   PASS — target/release/guest-booking-confirm (14 MB)
```

The production Vite entry is 15.64 KB gzip JS plus 8.49 KB gzip CSS; the
260 KB auth chunk is lazy and not requested on the landing page.

## Live product QA

- `/health` returned `{"build_sha":"10ad42f4b0e5b580488b00272c0462c4e6b90e79","status":"ok"}`.
- Desktop and 390×844 mobile loaded correctly. At 200% text, mobile width was
  `scrollWidth=390`, `clientWidth=390`.
- The demo banner reads “Demo — sample data, nothing is saved.” It offers
  reset and start-for-real controls. Confirming Maya's sample changes only
  `demo:guest-booking-confirm:state`; the browser recorded only same-origin
  document and static-asset requests, no cookies, no API mutation, tracking,
  or external request.
- The cold landing-page request log was also same-origin only (shell, hashed
  assets, artwork, and the same-origin settings read). No page or console
  errors occurred on normal `/`, `/demo`, `/privacy`, `/terms`, or `/manage`
  loads. Expected nonexistent/private-token recovery routes display their
  designed error states.
- Playwright AxeBuilder found zero serious or critical violations on landing,
  demo, privacy, terms, owner sign-in, missing booking, and 404 states.
  Keyboard Tab reaches the skip link and Enter focuses `main`; controls show
  designed 3px focus outlines. Reduced motion leaves only 0.01 ms animations.
- Live response headers include CSP with `frame-ancestors 'none'`, nosniff,
  DENY framing, same-origin referrer policy, and restrictive permissions
  policy. Hashed JS assets use `public, max-age=31536000, immutable`; HTML is
  no-cache. `/privacy`, `/terms`, robots, sitemap, and designed 404 responded
  as expected.
- Rate limits were independently measured live with a distinct forwarded
  client identity: 40 reads then 1×`429 Retry-After: 1`; 12 page-view writes
  then 2×`429 Retry-After: 1`; and 12 malformed license checks (`422`) then
  2×`429 Retry-After: 1`. `/health` remained 200.
- Owner access presents only Sociobot Microsoft Entra External ID; no owner
  password field is exposed.

## Defects by severity

None found.
