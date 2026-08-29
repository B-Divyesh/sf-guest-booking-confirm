# Visual thesis — the editorial date board

## Direction and rationale

Guest Booking Confirm is an **editorial date board**, not a generic scheduler. The public page pairs oversized magazine typography with overlapping calendar slips, colored confirmation marks, and angular notched panels. The composition makes timing and approval feel concrete before a guest opens the booking flow. The darker signal desk remains inside the working guest and owner views, where state matters more than explanation.

The interface is deliberately single-mode. A pale cream canvas, near-black ink, vivid orange-red action color, and muted olive confirmations echo marked-up paper calendars without imitating a paper form. Fine grain and angular section edges provide texture; shadows are short and crisp, and gradients are not used.

## Palette

| Token | Value | Role |
| --- | --- | --- |
| paper | `#F4F0E6` | pale cream page canvas |
| paper-deep | `#DED8C8` | calendar slips and inset tracks |
| panel | `#171814` | near-black hero and workflow panel |
| ink | `#181914` | primary text |
| muted | `#5D6253` | secondary text; remains 4.5:1 on cream |
| cream | `#FFFDF6` | text on dark panels |
| signal | `#F0522D` | vivid orange-red primary action and confirmation mark |
| signal-dark | `#A93218` | pressed state / accessible text |
| amber | `#D89A2B` | waiting state, always paired with words/icons |
| green | `#65734B` | muted olive confirmation, always paired with words/icons |
| red | `#A33B32` | cancel/error, always paired with words/icons |
| focus | `#146D87` | 3px keyboard focus ring |
| focus-dark | `#FFD166` | 3px keyboard focus ring on charcoal and green surfaces |

Contrast targets are at least 4.5:1 for body copy and 3:1 for controls and large display type. The focus ring uses teal on paper and warm yellow on dark panels so it remains at least 3:1 against adjacent surfaces. Status never depends on hue alone: every lamp has a label and shape/state copy.

## Typography

- Display: `Arial Black`, `Arial Narrow`, `Helvetica Neue`, system sans—condensed, uppercase, and poster-like for the main statement.
- Accent: `Georgia`, `Iowan Old Style`, serif in italic for the final word of display headings and date-card annotations.
- Interface: `Arial`, `Helvetica Neue`, system sans—neutral and exceptionally legible. No fonts are downloaded.
- Scale: 16px body, 18px lead, 22px section, and a 56–112px landing display. Numbers and dates use `font-variant-numeric: tabular-nums`.
- Text measures stay between 45 and 72 characters where possible.

## Spacing and form

An 8px base rhythm (`4, 8, 12, 16, 24, 32, 48, 64`). Corners are restrained: 2px paper panels, 8px control surfaces, pill shapes only for state indicators. Dense owner information sits on ruled rows; independent booking records are allowed to be cards. Controls are at least 44px high with 8px between adjacent targets.

Desktop uses an asymmetric editorial grid: copy occupies the left five columns and the date collage fills the right seven. Full-width bands use angular clipped corners rather than rounded cards. At 390px the copy and calendar stack, navigation wraps cleanly, and the primary action stays in normal document flow above the fold.

## Interaction grammar

- Landing date chips move one quiet selection mark across the calendar collage and update the visible selection note.
- A status change in the product illuminates one lamp and advances one position on the state rail.
- Buttons depress by 1px with a shorter shadow; async actions change their verb to a progress phrase.
- Dialogs are avoided. Destructive cancellation uses an inline, named confirmation step with a safe return.
- Loading uses a static engraved “Checking the signal…” panel; offline state keeps entered form values and offers Retry.
- Empty owner state shows the bare signal rail plus a direct link to share the booking page.

## Motion policy

Landing cards settle by 6–10px over 220ms when a date is selected; the movement reads as paper being placed on a desk. Product state transitions use 180–240ms opacity and transform movement. Nothing loops. With `prefers-reduced-motion: reduce`, transforms and smooth scrolling are removed and state changes are immediate opacity swaps.

## Editorial calendar texture

The landing date collage uses one generated, text-free image as a low-contrast paper and ink texture behind the HTML calendar cards. All dates, labels, statuses, and controls remain real accessible text.

Prompt sheet:

> Use case: stylized-concept. Asset type: subtle landing-page calendar collage backing texture. Primary request: an abstract editorial still life of overlapping blank appointment ledger sheets, crop marks, a single orange-red painted circle, one muted olive paper tab, and small black registration marks. Scene/backdrop: pale warm cream paper. Style/medium: tactile risograph print and cut-paper collage with fine natural grain. Composition/framing: wide landscape, broad quiet negative space, graphic shapes near the right and lower edges, no central subject. Lighting/mood: flat studio light, calm, precise, operational. Color palette: pale cream, near-black, vivid orange-red, muted olive. Constraints: no words, no letters, no numbers, no logos, no watermark, no gradients, no people, no devices. Avoid: legible calendar content, generic SaaS graphics, glossy 3D, rounded interface cards, decorative clutter.

Generated with the factory image tool on 2026-08-29. The original PNG and prompt sidecar are kept under `assets/src/`; the optimized WebP and a 4 KB quiet-grain crop under `public/assets/` are used on the landing page.

## Configured-desk asset provenance

The existing generated signal-console still life remains in the configured guest page. Its dark green case and illuminated coral lamp connect the new editorial landing page to the working booking-state interface. It illustrates “state you can see” without pretending to show product UI.

Prompt sheet:

> Use case: stylized-concept. Asset type: responsive website hero illustration. Primary request: an editorial still life of a compact mid-century appointment confirmation instrument, a dark forest-green enamel desk console with three tactile indicator windows, exactly one warm coral lamp illuminated, a blank cream appointment card emerging from a narrow slot, a small brass toggle, and a coiled dark cable. Scene/backdrop: warm oatmeal paper sweep. Style/medium: meticulously crafted gouache and cut-paper illustration with subtle print grain, not photorealistic and not a UI mockup. Composition/framing: landscape 3:2, instrument on the right half, calm open paper space on the left, clean silhouette, no cropped objects. Lighting/mood: soft late-afternoon studio light, dependable, quiet, reassuring. Color palette: forest charcoal, warm cream, coral red-orange, muted brass, aged paper. Materials/textures: enamel metal, matte paper, restrained screen-print grain. Constraints: no people, no text, no letters, no numbers, no logos, no watermark, no calendar grid, no phone, no laptop. Avoid: generic SaaS illustration, gradients, neon, glassmorphism, fake interface screenshots, brands, malformed switches, extra cables, clutter.

Generated using the factory Azure image deployment on 2026-08-28. The selected original PNG is retained with a prompt sidecar under `assets/src/`; WebP derivatives under `public/assets/` are production assets. Generated imagery is disclosed in the footer. All remaining marks and icons are original CSS/inline SVG authored for this project.

The 1,200 × 630 social card is a cropped, compressed derivative of that selected original. The 180 × 180 apple-touch icon is an original geometric rendering of the authored signal-lamp favicon in the documented palette; no third-party asset was used.
