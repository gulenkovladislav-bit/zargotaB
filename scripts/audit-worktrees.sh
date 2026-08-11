#!/bin/zsh

set -u

usage() {
  print -r -- "Использование: zsh scripts/audit-worktrees.sh [--source /absolute/worktree/path]"
}

source_path=""
if (( $# > 0 )); then
  if [[ "$1" != "--source" || $# -ne 2 ]]; then
    usage
    exit 2
  fi
  source_path="$2"
fi

current_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  print -u2 -r -- "Ошибка: команда запущена не внутри Git-worktree."
  exit 2
}

print -r -- "Zargota worktree audit (read-only)"
print -r -- "current: $current_root"
print -r -- ""
printf '%-62s %-10s %-24s %s\n' "WORKTREE" "HEAD" "BRANCH" "DIRTY FILES"
printf '%-62s %-10s %-24s %s\n' "--------" "----" "------" "-----------"

dirty_worktrees=0
detached_worktrees=0
while IFS= read -r worktree_path; do
  head_short="$(git -C "$worktree_path" rev-parse --short HEAD 2>/dev/null || print unknown)"
  branch="$(git -C "$worktree_path" symbolic-ref --quiet --short HEAD 2>/dev/null || print detached)"
  dirty_count="$(git -C "$worktree_path" status --porcelain=v1 -uall 2>/dev/null | wc -l | tr -d ' ')"

  [[ "$dirty_count" == "0" ]] || (( dirty_worktrees += 1 ))
  [[ "$branch" != "detached" ]] || (( detached_worktrees += 1 ))
  printf '%-62s %-10s %-24s %s\n' "$worktree_path" "$head_short" "$branch" "$dirty_count"
done < <(git worktree list --porcelain | sed -n 's/^worktree //p')

print -r -- ""
print -r -- "Итог: dirty worktrees=$dirty_worktrees; detached worktrees=$detached_worktrees"

if [[ -n "$source_path" ]]; then
  if [[ "$source_path" != /* ]]; then
    print -u2 -r -- "Ошибка: --source должен быть абсолютным путём."
    exit 2
  fi
  if ! git -C "$source_path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    print -u2 -r -- "Ошибка: source не является доступным Git-worktree: $source_path"
    exit 2
  fi

  source_head="$(git -C "$source_path" rev-parse HEAD)"
  current_head="$(git -C "$current_root" rev-parse HEAD)"
  source_branch="$(git -C "$source_path" symbolic-ref --quiet --short HEAD 2>/dev/null || print detached)"
  source_dirty="$(git -C "$source_path" status --porcelain=v1 -uall | wc -l | tr -d ' ')"
  divergence="$(git rev-list --left-right --count "$source_head...$current_head" 2>/dev/null || print unknown)"

  print -r -- ""
  print -r -- "HANDOFF SOURCE"
  print -r -- "source_worktree: $source_path"
  print -r -- "source_head: $source_head"
  print -r -- "source_branch: $source_branch"
  print -r -- "source_dirty_files: $source_dirty"
  print -r -- "source_vs_current_commits: $divergence (source-only current-only)"

  if (( source_dirty > 0 )); then
    print -r -- "WARNING: новый worktree от source_head НЕ унаследует эти $source_dirty локальных файлов."
    print -r -- "Нужен явный transfer_mode и список included_paths до начала редактирования."
  else
    print -r -- "OK: source чистый; его HEAD полностью описывает файловое состояние."
  fi
fi

print -r -- ""
print -r -- "Этот аудит ничего не изменил, не добавил в index и не создал stash."
