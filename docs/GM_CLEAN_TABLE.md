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


## Editable GM reminders (2026-11-20)

The small question mark in each dock card opens the existing curated `IRL_GM_FOCUS` entries. `zgIrlGmFocusData` returns a localized copy; the source lore is not changed. `gm-hero-reminders.js` permits editing titles, categories and text, adding or deleting blocks. Actions remain pinned below the scrolling editor.

Edits are local to this browser, namespaced by master UID, persistent sheet ID (local character ID in offline mode), and RU/UK locale. They never call `saveChars`, write player data or publish private notes. Failed local storage writes retain the draft and show an error. This is not cross-device synchronization.

Validation: `tests/gm-reminders-edge.cjs` covers seeded entries, per-character storage, edit/save/reload/cancel/add, escaping, RU/UK, the footer on a short viewport and Escape with a sheet open.

## Status library pilot (2026-11-20)

`gm-status-library.js/css` adds a dismissible library above the existing dock.
It reads the enabled `zgGmStatusCatalog` entries and the shared status glyphs;
there is no parallel list of invented effects. Search covers the full catalogue,
including entries outside Favorites. Favorites are a browser-local preference
per administrator. All new controls and notices have RU/UK variants.

Dragging uses pointer events and a movement threshold, so the board's protection
against accidental native image dragging stays in force. The narrow left-hand
“Everyone” target appears only during a drag. Dock spacing changes temporarily;
the existing cards and their normal layout are retained. Recipients are the
roster captured when dragging starts, not all accounts and not only online users.
Escape, pointer cancellation, leaving the page and releasing over empty space
cancel the gesture. Clicking a status shows its existing description and a
“Give…” alternative. Duration can follow the catalogue or be explicitly set.

`character-status-operations.js` builds the same `tempEffects`/`statuses` shape
as the character sheet's existing `applyStatus`. Ordinary repeats are no-ops;
bleeding increments its existing stack without resetting elapsed duration.
Legacy flags and ambiguous duplicate effects are handled explicitly. The new
controls use the existing character-round/time processing, not a wall-clock
timer or a new combat automation engine. Not every prose rule in the catalogue
is automatically enforced by the character sheet.

Persistent sheets are written through `ZargotaPersistentCharacters.tableStatus`
using the existing authenticated save/history API and acknowledged revision.
The master must be connected and the sheet ready; the player can be offline.
No legacy room is required, no seed replaces a sheet, and unrelated local drafts
are not included. A revision conflict or lost acknowledgement is reported, never
automatically retried (especially important for bleeding stacks). Batch writes
are independent and results list every recipient. There is no all-or-nothing
server transaction or offline master queue in this pilot.

Undo restores/removes only the exact confirmed effect if it still matches the
receipt. Later player edits or elapsed duration block undo, preserving those
changes. Local-only preview characters use the normal local character store;
failed local saves restore only the touched status fields.

Validation lives in `tests/character-status-operations.test.js`,
`tests/irl-shared-hp.test.js` and `tests/gm-status-library-edge.cjs`. The Edge
scenario uses isolated master/player clients and the real character transaction
domain behind a substituted transport; it never changes production players.

Status feedback (2026-11-21): the library footer keeps duration controls only.
Applied master changes on a player's persistent sheet announce newly granted
statuses (or added stacks) in a transient top banner: existing glyph, localized
name, remaining duration. Initial loads, repeated revisions, removals and timer
ticks stay silent. The banner does not take focus or intercept clicks; hidden-tab
notifications wait until visible, and auth changes clear the transient queue.
Right-clicking an active status in the mounted mobile sheet offers a single
Remove action through the sheet's existing removal/save path. Escape dismisses
only that menu; a normal click still opens status details. The two-client Edge
scenario covers the banner, replay suppression and synchronized context removal.


## Item library and player receipts (2026-11-21, local implementation)

The existing storage panel now has Statuses and Items sections. Items come from
`loadShopItems()` (the shared catalog); service entries are excluded. Search,
per-account favorites, pointer drag and the temporary left All target reuse the
status interface. Quantity applies to each recipient, not a divided party pool.
The bottom dock and Names tool are unchanged.

`character-item-grants.js` creates ordinary inventory snapshots through
`ZargotaItemEconomy.definitionToInventorySnapshot`. Each grant is a separate
stack, preserving customized/equipped copies. Explicit nonstackable definitions
receive separate instances. The inventory and compact `gmItemGrants` receipt are
saved atomically through the existing revision-checked sheet endpoint. No new
backend, seed replacement or second item catalog is introduced. Lost responses
are read back before reporting failure; batch writes remain per recipient.

`character-item-arrival.js/css` displays a full-screen native dialog only in the
owner player's active sheet. One reveal animation opens a batch; later grants
join the same dialog without replaying it. Arrows browse unread grants in order.
Accept acknowledges the current receipt via `gmItemAccepted` and advances to the
next; it never adds the item a second time. Closing leaves the receipt unread.
Fresh clients discover unaccepted receipts on the initial authoritative load,
including grants while the player was away. Accepted receipts do not replay after
reload or on another device. Receipt acceptance uses the same transactional API,
so conflicts/failed saves keep an explicit retry message. Account changes close
the dialog. RU/UK and reduced motion are supported. Accepted historical receipts
are pruned on the next grant; unread receipts are retained, with a 200-entry bound
that refuses further grants rather than silently dropping notices.

Checks: `tests/character-item-grants.test.js`,
`tests/gm-item-library-edge.cjs` (isolated Edge master and mobile player clients;
real character domain, substituted network; never production player accounts).
These local checks do not establish deployment or physical-iPhone behavior.

Storage filtering refinement (2026-11-21): one section row selects Statuses or
Items. A category selector uses existing shop category keys; a compact star
switches favorites-only mode. Category, favorites and search intersect rather
than overriding each other. There is no second All/Favorites tab row and no
local language selector. The global locale updates all labels while preserving
the query, category, favorite mode and quantity/duration controls.

Storage grant interaction: removed the secondary Give/recipient picker from both
Items and Statuses. Clicking a tile shows description only; granting uses drag
to a hero or the temporary All target. Quantity and duration controls remain.


Wallet/context refinement (2026-11-21, local): the four canonical currency IDs
credit copper/silver/gold/platinum directly in the wallet, atomically with the
receipt, rather than adding inventory entries. Other coin-shaped/magic items
remain items. Accept plays the existing coinChange or itemReward cue through the
shared sound engine on the player's gesture; repainting and arrow browsing are
silent. Empty locale strings fall back to the original item name.

Right-click a native inventory row for quantity-aware deletion. The menu resolves
the original item identity and rejects a changed snapshot. A failed local save
restores only untouched operation fields. Existing canonical coin stacks also
offer Move to wallet, using the selected quantity and a single normal sheet save.
This explicitly invoked repair avoids silently migrating live accounts.


## Table preparation objects (2026-11-21, local)

`gm-table-objects.js/css` stores catalog references and grant options locally per
master UID. Drag an item/status from storage to bare table background to prepare
it. A single click shows description, properties and stats through the shared item
presentation model (and editable quantity for items). Left-drag moves an object
on the board; dropping on a hero or All uses the existing transaction path. The prepared object
stays on the table. Releasing a drag or resize does not open details. The bottom-right grip changes its size,
and right-click offers Remove from table. Removing a preparation reference does
not delete player inventory. Escape/pointer cancellation rolls back unfinished
geometry gestures. Position/size/quantity survive reload; viewport resizing keeps
objects reachable. Leaving the table or changing accounts dismisses transient UI.
Only the blank table accepts new placements; dropping over controls does nothing.
Folders and cross-device preparation syncing are not implemented in this step.

Marquee selection (local): left-drag on bare board selects intersecting prepared
cards. Shift/Ctrl/Cmd-click toggles members; a blank click or Escape clears
selection. Dragging a selected card moves the group with preserved spacing;
dropping on a hero/All delivers each selected catalog reference in sequence
through the existing sheet operations. Options and recipients are snapshotted at
drag start; results name any failed card. This is not an atomic batch: successful
entries are retained if another fails, and no entries are retried automatically.
Notes/letters are not yet available as grantable table objects.
