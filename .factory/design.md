# Visual thesis — the calm signal desk

## Direction and rationale

Guest Booking Confirm is a **mid-century instrument panel**, not a generic scheduler. A booking is shown as a signal moving through a small control desk: request, owner approval, guest confirmation, reminder, complete. This makes the otherwise invisible state legible to a busy sole operator. Physical details—engraved labels, a signal lamp, numbered rails, inset paper, and restrained hardware—explain status rather than decorate it.

The interface is deliberately single-mode. A warm paper background and dark charcoal console are painted explicitly; this is closer to a dependable daytime workshop instrument than an ambient consumer app. It avoids a second theme whose color remapping could weaken the semantic lamp system.

## Palette

| Token | Value | Role |
| --- | --- | --- |
| paper | `#F3EBDD` | page background, like an appointment card |
| paper-deep | `#E4D8C5` | inset tracks and dividers |
| panel | `#202A28` | primary console surface |
| ink | `#17201E` | text |
| muted | `#5F665F` | secondary text; remains 4.5:1 on paper |
| cream | `#FFF9EE` | text on panel |
| signal | `#E85D3F` | primary action and live signal |
| signal-dark | `#A83422` | pressed state / accessible text |
| amber | `#D89A2B` | waiting state, always paired with words/icons |
| green | `#2C7559` | confirmed state, always paired with words/icons |
| red | `#A33B32` | cancel/error, always paired with words/icons |
| focus | `#146D87` | 3px keyboard focus ring |
| focus-dark | `#FFD166` | 3px keyboard focus ring on charcoal and green surfaces |

Contrast targets are at least 4.5:1 for body copy and 3:1 for controls and large display type. The focus ring uses teal on paper and warm yellow on dark panels so it remains at least 3:1 against adjacent surfaces. Status never depends on hue alone: every lamp has a label and shape/state copy.

## Typography

- Display: `Georgia`, `Iowan Old Style`, serif—bookish, human, and reminiscent of printed instrument manuals.
- Interface: `Arial`, `Helvetica Neue`, system sans—neutral and exceptionally legible. No fonts are downloaded.
- Scale: 16px body, 18px lead, 22px section, 32–56px display. Numbers and dates use `font-variant-numeric: tabular-nums`.
- Text measures stay between 45 and 72 characters where possible.

## Spacing and form

An 8px base rhythm (`4, 8, 12, 16, 24, 32, 48, 64`). Corners are restrained: 2px paper panels, 8px control surfaces, pill shapes only for state indicators. Dense owner information sits on ruled rows; independent booking records are allowed to be cards. Controls are at least 44px high with 8px between adjacent targets.

Desktop pages use an asymmetric 12-column console with the workflow instrument to the right. At 390px it becomes one column, secondary explanation shortens, owner tables become stacked records, and the primary action remains in normal document flow above the fold.

## Interaction grammar

- A status change illuminates one lamp and advances one position on the state rail.
- Buttons depress by 1px with a shorter shadow; async actions change their verb to a progress phrase.
- Dialogs are avoided. Destructive cancellation uses an inline, named confirmation step with a safe return.
- Loading uses a static engraved “Checking the signal…” panel; offline state keeps entered form values and offers Retry.
- Empty owner state shows the bare signal rail plus a direct link to share the booking page.

## Motion policy

State transitions use 180–240ms opacity and transform movement, as if a physical indicator has slid to its next detent. The live lamp receives one short 600ms glow after a state change; nothing loops. With `prefers-reduced-motion: reduce`, transforms and smooth scrolling are removed and state changes are immediate opacity swaps.

## Original asset plan and provenance

One generated hero still-life anchors the public page: a small 1960s appointment signal console, seen three-quarter overhead, with a blank cream card, coral confirmation lamp, dark green metal case, brass toggle, tactile paper texture, and generous quiet negative space. It illustrates “state you can see” without pretending to show product UI.

Prompt sheet:

> Use case: stylized-concept. Asset type: responsive website hero illustration. Primary request: an editorial still life of a compact mid-century appointment confirmation instrument, a dark forest-green enamel desk console with three tactile indicator windows, exactly one warm coral lamp illuminated, a blank cream appointment card emerging from a narrow slot, a small brass toggle, and a coiled dark cable. Scene/backdrop: warm oatmeal paper sweep. Style/medium: meticulously crafted gouache and cut-paper illustration with subtle print grain, not photorealistic and not a UI mockup. Composition/framing: landscape 3:2, instrument on the right half, calm open paper space on the left, clean silhouette, no cropped objects. Lighting/mood: soft late-afternoon studio light, dependable, quiet, reassuring. Color palette: forest charcoal, warm cream, coral red-orange, muted brass, aged paper. Materials/textures: enamel metal, matte paper, restrained screen-print grain. Constraints: no people, no text, no letters, no numbers, no logos, no watermark, no calendar grid, no phone, no laptop. Avoid: generic SaaS illustration, gradients, neon, glassmorphism, fake interface screenshots, brands, malformed switches, extra cables, clutter.

Generated using the factory Azure image deployment on 2026-08-28. The selected original PNG is retained with a prompt sidecar under `assets/src/`; WebP derivatives under `public/assets/` are production assets. Generated imagery is disclosed in the footer. All remaining marks and icons are original CSS/inline SVG authored for this project.

The 1,200 × 630 social card is a cropped, compressed derivative of that selected original. The 180 × 180 apple-touch icon is an original geometric rendering of the authored signal-lamp favicon in the documented palette; no third-party asset was used.
