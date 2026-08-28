# Zargota workspace rules

## Worktree handoff gate

Before changing files for a task that continues or combines another Zargota task:

1. Read `WORKTREE_COORDINATION.md`.
2. Run `zsh scripts/audit-worktrees.sh`.
3. Identify the exact source worktree and run the audit again with `--source`.
4. Record source path, HEAD, branch/detached state, dirty-file count, transfer mode,
   included paths, excluded paths, and required validation in the task commentary.
5. If the source is dirty, do not assume that its HEAD, branch name, task title,
   or chat handoff contains the local changes. Compare and transfer them explicitly.

Never replace shared high-conflict files wholesale when integrating parallel work.
Preserve unrelated dirty changes. Do not commit, push, reset, stash, delete, or move
work between worktrees unless the user explicitly authorizes that operation.

## Bilingual user-facing text gate

Whenever Codex adds or changes user-facing prose, add the Russian and Ukrainian
variants in the same change. This includes the current entry in
`ZG_APP_CHANGELOG`: keep the Russian text in `notes` and the Ukrainian text in
`notesUk`. Do not leave a new interface label, description, notice, or update-log
entry in only one locale. Technical identifiers and developer-only comments are
exempt.
