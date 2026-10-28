#!/usr/bin/env bash
# disk.sh: fail fast, with a clear cause, when the disk is full or over quota. Source scripts/lib/result.sh first.
#
#   disk_guard <main_checkout> <worktree_root> [dir...]
#
# Checks every directory (the main checkout, the worktree root, $TMPDIR if set, ~/tmp, and any extra dir) for
#   - at least PR_DISK_MIN_MB free (default 2048, which is 2 GiB), and
#   - a successful 64 KiB write (a quota error such as "Disk quota exceeded" shows up here, not in df).
# On failure it records cause "disk" in result.json with a next command that lists the largest worktrees and the
# finished ones, prints the same to stderr and exits 1. A dir that does not exist is skipped.
# Why: a full or over-quota disk breaks even `pwd`, so the scripts after it failed in confusing ways.

DISK_MIN_MB=${PR_DISK_MIN_MB:-2048}

# disk_probe <dir>: prints the problem and returns 1, or returns 0.
disk_probe() {
  local dir=$1 free_kb free_mb probe out
  [[ -d "$dir" ]] || return 0
  if ! free_kb=$(df -Pk -- "$dir" 2>/dev/null | awk 'NR==2 {print $4}') || [[ ! "$free_kb" =~ ^[0-9]+$ ]]; then
    echo "cannot read the free space of $dir (df failed)"; return 1
  fi
  free_mb=$((free_kb / 1024))
  if (( free_mb < DISK_MIN_MB )); then
    echo "only ${free_mb} MiB free on the filesystem of $dir, need ${DISK_MIN_MB} MiB"; return 1
  fi
  if ! probe=$(mktemp -p "$dir" .disk-probe.XXXXXX 2>&1); then
    echo "cannot write in $dir: ${probe##*: }"; return 1
  fi
  if ! out=$(dd if=/dev/zero of="$probe" bs=64k count=1 conv=fsync 2>&1 >/dev/null); then
    rm -f "$probe"; echo "cannot write in $dir: $(tail -n1 <<<"$out")"; return 1
  fi
  rm -f "$probe"
}

disk_guard() {
  local main=$1 root=$2 dir problem seen=" "; shift 2
  local dirs=("$main" "$(dirname "$root")" "$root")
  # Scratch goes under ~/tmp, not the tmpfs /tmp, so /tmp is checked only when TMPDIR points at it.
  [[ -z "${TMPDIR:-}" ]] || dirs+=("$TMPDIR")
  [[ -z "${HOME:-}" ]] || dirs+=("$HOME/tmp")
  dirs+=("$@")
  for dir in "${dirs[@]}"; do
    [[ "$seen" != *" $dir "* ]] || continue
    seen+="$dir "
    problem=$(disk_probe "$dir") && continue
    local next="cd '$main' && du -sh '$root'/* 2>/dev/null | sort -h | tail -n 8; scripts/cleanup-worktree.sh --dry-run"
    result_fail disk "$problem" "$next"
    {
      echo "error: disk preflight failed: $problem"
      echo "Free space, then run this again. Largest worktrees, and the finished ones that can go:"
      echo "  $next"
      echo "Remove one finished worktree with: scripts/cleanup-worktree.sh <issue#>"
    } >&2
    exit 1
  done
}
