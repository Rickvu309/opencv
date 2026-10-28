#!/usr/bin/env bash
# disk.sh: fail fast, with a clear cause, when the disk is full or over quota. Source scripts/lib/result.sh first.
#
#   disk_guard <main_checkout> <worktree_root> [dir...]
#
# Checks the main checkout, the worktree root, ~/tmp, any extra dir and the effective temp dir (${TMPDIR:-/tmp}) for
#   - enough free space: PR_DISK_MIN_MB (default 2048, 2 GiB), or PR_TMP_MIN_MB (default 256) for the temp dir, which
#     is often a small tmpfs, and
#   - a successful 64 KiB write (a quota error such as "Disk quota exceeded" shows up here, not in df).
# Both limits are whole numbers of MiB. A dir that does not exist is skipped.
# A full disk or a failed write records cause "disk" in result.json with a next command that lists the largest
# directories and the finished worktrees. A bad limit, a dir that cannot be written for another reason, or a missing
# tool records cause "env". Either way it prints the same to stderr and exits 1.
# Why: a full or over-quota disk breaks even `pwd`, so the scripts after it failed in confusing ways.

# disk_probe <dir> <min_mb>: on a problem prints "<cause><TAB><text>" and returns 1.
disk_probe() {
  local dir=$1 min_mb=$2 free_kb free_mb probe out tool
  for tool in df awk mktemp dd rm; do
    command -v "$tool" >/dev/null 2>&1 || { printf 'env\t%s is not installed\n' "$tool"; return 1; }
  done
  if ! free_kb=$(df -Pk -- "$dir" 2>/dev/null | awk 'NR==2 {print $4}') || [[ ! "$free_kb" =~ ^[0-9]+$ ]]; then
    printf 'env\tcannot read the free space of %s (df failed)\n' "$dir"; return 1
  fi
  free_mb=$((free_kb / 1024))
  if (( free_mb < min_mb )); then
    printf 'disk\tonly %s MiB free on the filesystem of %s, need %s MiB\n' "$free_mb" "$dir" "$min_mb"; return 1
  fi
  if ! probe=$(mktemp -p "$dir" .disk-probe.XXXXXX 2>&1); then
    out=${probe##*: }; _disk_write_problem "$dir" "$out"; return 1
  fi
  if ! out=$(dd if=/dev/zero of="$probe" bs=64k count=1 conv=fsync 2>&1 >/dev/null); then
    rm -f "$probe" 2>/dev/null || true
    _disk_write_problem "$dir" "$(tail -n1 <<<"$out")"; return 1
  fi
  rm -f "$probe" 2>/dev/null || true
}

# _disk_write_problem <dir> <error text>: a full disk or quota is cause disk, anything else (permissions) is env.
_disk_write_problem() {
  local cause=env
  shopt -s nocasematch
  [[ "$2" == *quota* || "$2" == *"no space"* || "$2" == *"disk full"* || "$2" == *"too large"* ]] && cause=disk
  shopt -u nocasematch
  printf '%s\tcannot write in %s: %s\n' "$cause" "$1" "$2"
}

# _disk_fail <cause> <problem> <next>
_disk_fail() {
  result_fail "$1" "$2" "$3"
  {
    echo "error: disk preflight failed: $2"
    if [[ "$1" == disk ]]; then
      echo "Free space, then run this again. Largest directories, and the finished worktrees that can go:"
      echo "  $3"
      echo "Remove one finished worktree with: scripts/cleanup-worktree.sh <issue#>"
    fi
  } >&2
  exit 1
}

disk_guard() {
  local main=$1 root=$2 dir real out cause problem next big seen=$'\n'
  local -a dirs=() mins=(); shift 2
  local min=${PR_DISK_MIN_MB:-2048} tmp_min=${PR_TMP_MIN_MB:-256}
  [[ "$min" =~ ^[0-9]+$ ]] || _disk_fail env "PR_DISK_MIN_MB must be a whole number of MiB, got '$min'" ""
  [[ "$tmp_min" =~ ^[0-9]+$ ]] || _disk_fail env "PR_TMP_MIN_MB must be a whole number of MiB, got '$tmp_min'" ""
  dirs=("$main" "$(dirname "$root")" "$root")
  [[ -z "${HOME:-}" ]] || dirs+=("$HOME/tmp")
  dirs+=("$@")
  for dir in "${dirs[@]}"; do mins+=("$min"); done
  dirs+=("${TMPDIR:-/tmp}"); mins+=("$tmp_min")
  local i
  for i in "${!dirs[@]}"; do
    dir=${dirs[i]}
    [[ -d "$dir" ]] || continue
    real=$(cd -P -- "$dir" 2>/dev/null && pwd) || real=$dir
    [[ "$seen" != *$'\n'"$real"$'\n'* ]] || continue
    seen+="$real"$'\n'
    out=$(disk_probe "$dir" "${mins[i]}") && continue
    IFS=$'\t' read -r cause problem <<<"$out"
    big=$root
    case "$dir" in "$main"|"$(dirname "$root")"|"$root") ;; *) big=$dir ;; esac
    printf -v next 'cd %q && { du -sh %q/* 2>/dev/null | sort -h | tail -n 8; scripts/cleanup-worktree.sh --dry-run; }' "$main" "$big"
    [[ "$cause" == disk ]] || next=""
    _disk_fail "${cause:-env}" "${problem:-cannot probe $dir}" "$next"
  done
}
