# Clean table — first implementation

Approved scope: calm cartographic background, five wider party cards, and the
existing mobile character sheet opened over the table. The only tool on the board
is Names; saved names are accessed inside its popover. A small Home exit remains.
The old scene selector, drawers, pin layer and tools menu have been removed.
Their stored data and shared data APIs are preserved; retired workspace/preparation
UI no longer mounts or renders on the clean table.
No new delivery workflow or new network synchronization protocol is introduced.

## Code and data ownership

- The table **moves the existing `#page-characters` DOM node** into a bounded
  `.zg-gm-sheet-host`; closing restores it at its original placeholder. It calls
  the ordinary `openCharSheet`/`renderCharSheet` functions in the same document.
  There is no iframe, srcdoc, cloned application, or second bootstrap/auth client.
- The renderer accepts the hosted sheet as a mobile presentation regardless of
  desktop viewport width. The same collection, ID resolution, events, permissions,
  save/history path and incoming update handling serve the regular sheet and table.
- Existing mobile modules route their dialogs/nav into the host only while it is
  open. Artwork and lore dialogs use nonmodal `dialog.show()` inside the panel;
  ordinary sheets retain the full-screen modal behavior. Switching heroes closes
  the previous hero's dialogs. Leaving the table restores the regular page.
- Existing mobile CSS is adapted to the component dimensions and scoped under
  `.zg-gm-sheet-host`. Media conditions and viewport units use the host dimensions;
  fixed overlays become component-positioned overlays. Board/editor styles are
  not imported. No mobile UI markup or rules are maintained as a separate design.
- Direct `file://` launch cannot read linked stylesheet CSSOM. The generated
  `gm-sheet-styles.js` supplies the same source CSS for both file and HTTP modes.
  Run `node scripts/build-gm-sheet-styles.cjs` after editing mobile CSS;
  `--check` detects stale generated output. The browser parses it in a constructed
  stylesheet without requesting or executing a second document.
- Connected sheet IDs are resolved through `ZargotaPersistentCharacters`.
  The dock HP control uses the existing `tableHp` transaction when connected;
  local heroes use normal `saveChars`. Test accounts do not add extra campaign
  cards to the five-hero dock. Incoming updates respect focused editable fields.
- Remote phone propagation still requires explicit two-device validation; local
  UI checks do not prove remote synchronization.

## Asset

`images/session-ui/clean-table-cartography-v1.webp` — built-in imagegen output,
converted to WebP for the shipped background (about 76 KiB). Original generated
PNG remains in the Codex generated-images folder.

Prompt:

> Create a production background asset for a dark fantasy game master's free canvas.
> Landscape 16:10, high resolution. Almost black warm brown parchment, extremely
> subtle hand engraved antique brass / muted ochre contour drawings: small groups
> of distant jagged mountains upper left and right, sparse miniature pine trees,
> a gently curving river lower left. A very faint evenly spaced tiny gold dot grid
> over the surface. Huge calm dark empty center, understated low contrast throughout,
> no glowing highlights. Flat overhead graphic texture, intricate refined
> cartographer's penmanship, not a landscape painting or perspective room. Entire
> image is the background surface, edge to edge. No interface, no cards, no portraits,
> no lettering, no words, no labels, no border. Must sit behind ivory text and
> draggable panels without distracting, matching black-and-antique-gold fantasy UI.

## Verification

`tests/gm-clean-table-edge.cjs` runs an isolated Edge context with backend requests
blocked and a test-only local collection. It covers five heroes × four tabs, HP
round trip, item-dialog switching, dragging, four desktop viewport sizes, RU/UK,
Names/saved names, accidental selection/image-drag prevention, and return to the ordinary phone layout. It opens/closes the story
editor before opening sheets and asserts the same original sheet/editor nodes
remain, with no nested page and no new document-navigation requests.

Run with `ZG_TEST_URL=file:///Users/merkov/Documents/GitHub/zargotaB/index.html`
for direct-file launch, or use the default `http://127.0.0.1:8765` local server.
Screenshots go to `ZG_TEST_OUTPUT` or `/private/tmp/zg-clean-table-review`.
The existing sheet initializes missing empty statuses/death saves when opened;
the test checks authored fields/inventories remain intact.

The iframe implementation and its prior passing checks were insufficient: a live
editor could be cloned/restored into that second application. That implementation
has been replaced, rather than hiding the unrelated editor with CSS.
No live account data changes, commit, push, or production publish are part of this fix.

Verified on 2026-11-18: HTTP and direct-file Edge flows passed; native-dialog
bounds, no navigation, editor-node identity, draft preservation on dock refresh,
restoration to the normal mobile sheet, and an edit after leaving the table were
checked. Shared HP/account/session tests passed (45 tests). Generated CSS freshness,
JS syntax, and `git diff --check` passed. Screenshots use isolated local fixtures.

## Clean controls — 2026-11-18

Removed the old overflow-menu creation/listeners/styles and retired board markup
(scene/background, NPC/event/scene/note drawers, pinned cards and attention toast).
The scene/preparation data APIs remain because they own existing saved content;
absence of the retired UI prevents their render/mount path from running.
This is scoped cleanup, not a claim that all unused code in the project is gone.

Board text selection and native image/link dragging are disabled; inputs and
contenteditable retain native selection. Foreign drops on the empty canvas are
cancelled. Header dragging and normal portrait/item clicks remain available.
The editor reopen launcher is suppressed only while the GM table is active.

Validation: isolated Edge direct-file flow covers five heroes, four tabs, four
viewport sizes, HP, Names/save/reopen, native sheet dialogs and editor selection,
real pointer dragging/double clicks and rejected foreign canvas drops. The 26
session/shared-HP/character tests pass. The older name-generator static test fails
on an exact 15.5px font-size assertion in both the before-change snapshot and
current file; name generation and saved-name reopening pass the browser flow.
No live data writes or production publication were performed.

## Existing player profiles — 2026-11-20

The dock's `＋` opens a participant picker for the administrator's existing
persistent accounts. Presence is displayed separately from membership: an offline
player can remain at the table. No invitation, second login, room protocol or copy
of a character is created. The normal persistent-character subscription and
save/history/conflict path still owns synchronization in both directions.

`gm-table-participants.js` stores only sheet IDs, per administrator, under the
current local session's `data.gmParticipants.owners`. This layout preference stays
on the master's device; it is not a new shared campaign entity. Unconfigured
tables retain the five existing heroes; the picker can add any owned profile,
including a custom character, or leave the roster empty. Removing a participant
does not delete their account, unsubscribe their normal sheet, or change data.
An authenticated table never substitutes an unrelated local seed for an
unavailable account. Other identities cannot reuse the saved roster.

At five or more cards the plus is hidden and the cards use the full dock width.
Right-click a card to see connection status, open its sheet, choose players, or
remove it from this table. After removal below five, the plus reappears. The
menu stays inside the viewport and supports keyboard navigation. Removing a
local-only preview card also changes only the session's roster (`localKeys`).

The same native mobile sheet is used inside the table. HP controls retain the
acknowledged transactional save and lock when the master has no connection.
Full-sheet edits retain the existing offline/conflict behavior. The picker does
not access login codes or write to Firebase directly.
The hosted sheet now checks the editor's computed visibility: the hidden inline
style `display:none` must not mark it busy and indefinitely defer remote updates.

`tests/gm-table-participants-edge.cjs` runs two isolated Edge clients with the real
sync controller and character-domain transactions behind a substituted transport.
It covers profile selection, live presence, HP/full-sheet exchange, cancellation,
reload, offline controls, removal, signout, and RU/UK labels. This is a local
regression check, not verification on the user's phone or a production deployment.

Verified locally: participant/context-menu two-client Edge scenario passed; the
existing five-hero/four-tab/four-viewport Edge regression passed, including the
unsaved editor field. All 32 focused persistent-session/character/shared-HP tests,
JS syntax, generated sheet CSS freshness and index diff whitespace checks passed.
No production writes, account changes, commit or publish were performed.
