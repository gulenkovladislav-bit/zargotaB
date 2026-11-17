# Character updates from code (operator instructions)

For requests such as “upgrade this player's personal ability”, use
`scripts/character-patch.cjs`. Do not manually re-enter every field in the browser,
change the global spell catalog, or replace a live sheet with a seed from Git.
The tool is not loaded by the website; it adds no browser payload, service or npm
dependency. It reuses `characterAccess/save` and `functions/character-domain.js`.

## Routine workflow

```sh
node scripts/character-patch.cjs list
node scripts/character-patch.cjs show --character lin-yin
node scripts/character-patch.cjs apply --patch /private/tmp/change.json
node scripts/character-patch.cjs apply --patch /private/tmp/change.json --write
```

On this Mac, when Node is absent from PATH, use
`/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node`.
`show` prints private sheet data: inspect selectively, never publish it or codes.
Preview is the default; `--write` applies the user's authorized change. Preview
does not reserve a revision: write reads the latest sheet and merges again.

Example patch (developer-only sample, not a player-facing ability):

```json
{
  "characterId": 1778221143711,
  "campaignKey": "lin-yin",
  "operations": [
    {
      "collection": "skills",
      "match": {"id": "existing-ability-id"},
      "set": {"description": "Approved replacement text"}
    }
  ]
}
```

Use actual IDs from the live read, never invented character names. For old entries
without IDs, `match: {"name": "exact existing name"}` is supported, but only a
unique match may be edited. To add a new ability use a stable `match.id`, `set`
with approved name/type/description/art and `create` with initial defaults, e.g.
`{"cdMax":0,"cdUsed":0,"usages":""}`. Defaults apply only on insertion. A later
update leaves current uses, cooldown and all unspecified fields intact. Duplicate
IDs/names stop the operation. Supported collections: skills, mastery,
inventoryItems, journalEntries (legacy exact-name matching if no `id` exists),
and family (stable-ID matching only).
No whole-sheet replacement or deletion operation is exposed.

For an authorized stock portrait replacement, use the same `apply` command with
an exact source path and the published replacement:

```json
{
  "characterId": 1778221143711,
  "campaignKey": "lin-yin",
  "portrait": {
    "from": "images/portraits/char_1778221143711.png",
    "to": "images/portraits/defaults/lin-yin-2026-11.png"
  }
}
```

`portrait` accepts only `from` and `to`, both relative raster image paths under
`images/` or `assets/`; external URLs, traversal and query strings are rejected.
The current portrait must equal `from`. A thumbnail or saved `portraitChoice`
blocks replacement, preserving personal uploads and explicit stock/fog choices.
Only the portrait and its obsolete `portraitFocusX`/`portraitFocusY` change.
If the current path already equals `to`, the portrait operation is a no-op and
keeps all focus/choice fields. Entry `operations` may accompany this change or
be omitted/empty for a portrait-only patch. Preview, revision checks, private
backup, canonical read-back and master history use the existing save workflow.

## Biography and close connections

For an approved biography, provide both locales and the exact text observed in
the live sheet. `null` as a source means the field was absent or null; it does
not match an existing empty string. This narrow operation changes only
`biography` and `biographyUk`, never `currentGoal`, other lore, or the full sheet.

```json
{
  "characterId": 1778221143711,
  "campaignKey": "lin-yin",
  "biography": {
    "from": "",
    "fromUk": null,
    "ru": "Approved Russian biography.",
    "uk": "Approved Ukrainian biography."
  },
  "operations": [
    {
      "collection": "family",
      "match": {"id": "known-person-stable-id"},
      "create": {"parentId": "root", "dir": "other", "relationshipLevel": ""},
      "set": {
        "name": "Established Russian name",
        "nameUk": "Established Ukrainian name",
        "relation": "Established relationship in Russian",
        "relationUk": "Established relationship in Ukrainian",
        "knownInfo": "Player-known facts in Russian",
        "knownInfoUk": "Player-known facts in Ukrainian",
        "lifeStatus": "unknown"
      }
    }
  ]
}
```

`biography` accepts exactly `from`, `fromUk`, `ru`, and `uk`. If both current
texts already equal the requested targets, the biography operation is a no-op.
Otherwise both must match their sources; a change to either locale stops the
operation for inspection. `operations` may be omitted for a biography-only
patch, and a biography may be combined with a portrait or entry patch.

Add/update connections individually by their actual stable IDs. An insertion
requires a non-empty name; an existing same-name person blocks accidental
duplication. Accepted family fields are `name`, `nameUk`, `relation`,
`relationUk`, `region`, `regionUk`, `knownInfo`, `knownInfoUk`, `note`, `noteUk`,
`relationshipLevel`, `parentId`, `dir`, `portrait`, `image`, `icon`, and
`lifeStatus`, and the classic compatibility field `dead`. All except `dead`
must be strings; `dead` must be a boolean. Keep it `true` only when `lifeStatus`
is `dead`, and `false` for the other explicit statuses; it does not establish that
an unknown person is alive. `lifeStatus` is one of `alive`,
`dead`, `unknown`, `undead`; do not infer that someone is alive merely because
no death was recorded. `relationshipLevel` uses the existing values `""`,
`hostile`, `wary`, `neutral`, `trust`, or `close`. Family tree cycles are rejected
by the existing character validator. Other people and all unspecified fields,
including personal notes and portraits, remain untouched.

Read relevant `GLOBAL_LORE.md` sources before authoring rules/lore. Keep RU/UK
translations together: ability text uses the existing character translation
sidecar; biographies and family records use the explicit locale fields above. Images
must be published and verified at the live URL BEFORE writing their paths. A
local PNG or Git commit alone is not proof of a served asset. Do not embed full
PNG files in sheets. A personal upgrade does not change other players/catalog.

## Pairing (already completed on this Mac)

Default session: `~/.config/zargota/operator-session.json`, permissions 0600,
outside Git. Normal commands refresh it automatically. This is the existing
master identity, not a new admin account. No Firebase CLI/Google login is needed.
Do not inspect or print its contents. If the session is revoked, expired, or this
is a new machine, pair once using an authorized recovery-code file:

```sh
node scripts/character-patch.cjs login --code-file /private/tmp/master-code
```

The code file must have mode 0600 and reside outside the repository. It may be
plain text or the existing provisioner's JSON `{uid,code}`. The short master PIN
cannot pair a new client. Retrieve a code only with the user's authorization;
never create a replacement account, scrape browser credentials, or publish it.
Remove the temporary code file after successful pairing. `--session` can select
another private location. Lost/revoked sessions require pairing again; this tool
does not bypass authentication.

## Saving and verification

The script reads the canonical sheet, merges specified entry fields, validates
with the backend domain, and saves with its current revision. Concurrent edits
cause a conflict and stop; inspect/re-run against the new sheet, never force the
old entire snapshot. Unchanged patches are no-ops. A lost response is checked
against the operation ID before any success claim.

Before writing, a private recovery snapshot and payload are saved alongside the
session under `backups/`. No automatic rollback: later player edits must not be
overwritten. Successful saves require read-back and the server's master history
entry. If newer edits already arrived, verify the committed history rather than
mistaking those edits for a failed save. The existing website receives the master
update and uses its normal change notices; first-ever uncached loads simply show
current data. Test: `node --test tests/character-patch.test.js`.
