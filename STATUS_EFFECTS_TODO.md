# Status effects: visual integration TODO

## Goal

Make every canonical combat status immediately readable on all character surfaces without creating another status schema or adding preview-only Firebase writes.

## Canonical set (23)

- Control: `stun`, `freeze`, `paralyze`, `restrain`, `prone`, `fear`, `blind`, `charm`, `dominate`, `confusion`.
- Damage over time: `burn`, `poison`, `bleed`.
- Debuffs: `slow`, `curse`, `exhausted`, `silence`, `anchor`.
- Buffs: `invisible`, `regen`, `shield`, `rage`, `fly`.

## Surfaces

- Round scene token: dynamic diameter, roughly 24–240 px.
- Top combat portrait: 82 × 76 px, compact variant 70 × 66 px.
- Large State portrait: responsive portrait, roughly 145–205 px high.
- Character-sheet portrait: compact square preview when the sheet is open.

The same semantic status art may be reused between portrait surfaces, but its crop, inset and border radius must be supplied by the surface adapter. Round tokens must never receive a rectangular crop.

## Work blocks

- [x] Audit the existing status models, normalization and 23-key visual catalog.
- [x] Keep QA local preview alive across scene/runtime rerenders.
- [x] Make Repeat and Clear operate on the currently selected token deterministically.
- [x] Add one reusable status-overlay renderer for tokens and portraits.
- [x] Attach overlays to the scene token, top combat portrait, State portrait and sheet portrait.
- [ ] Keep the two highest-priority statuses visually available without covering the face.
- [ ] Verify all 23 atlas cells; redraw weak or poorly cropped cells as fitted transparent assets.
- [x] Give full-surface statuses (freeze, shield, invisible, curse, poison) a translucent layer over the portrait, not only an outer ring.
- [x] Give directional/particle statuses a restrained animated layer that pauses off-screen and with reduced effects.
- [ ] Test token-size adaptation, compact portrait crop and large portrait crop.
- [x] Run status, QA sandbox, render-performance and two-client combat checks.

## Compatibility and performance rules

- Reuse normalized status keys and the existing `statusEffects`/`statuses` readers; do not add a fifth schema.
- QA preview is local DOM state only. It must not mutate the room, character, combat order or Firebase.
- Persistent statuses remain authoritative and can coexist with one local preview.
- Reuse a small number of atlases/layers; no per-frame Firebase work, canvas loop or unbounded timers.
- Pause animation outside the viewport, on hidden tabs and in reduced-effects/reduced-motion modes.
- Preserve legacy status data until a separate, backed-up migration is approved.

## Acceptance checks

- Selecting a token and a status immediately shows the visual; Repeat visibly replays it; Clear removes it.
- A routine token patch does not remove local preview.
- The same active status appears on the map token, top portrait and State portrait.
- Freeze visibly covers part of the portrait with translucent frost and also extends beyond its edge.
- No rectangular overflow appears on round tokens; no important face area is fully obscured.
- Existing combat/status contracts, Firebase payloads and room compatibility remain unchanged.
