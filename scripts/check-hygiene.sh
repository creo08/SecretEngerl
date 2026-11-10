#!/usr/bin/env bash
# Checks that commits are safe to publish in the public repository.
#
# Rules: author and committer are exactly the maintainer's identity, commit
# messages carry no tool trailers or session URLs, and no added line in any
# file contains those strings or an email address other than the maintainer's.
#
# With HYGIENE_ALLOW_DEPENDABOT=1, commits made by Dependabot (its author and
# GitHub as committer) pass the identity check; the other rules still apply.
# CI sets it only on Dependabot's own branches. Those commits are never merged
# or promoted as they are: the pre-push hook and the promote workflow stay strict.
#
# Usage:
#   scripts/check-hygiene.sh <git rev-list arguments>   e.g. HEAD, origin/main..HEAD
#   scripts/check-hygiene.sh --commit-msg <file>         used by .githooks/commit-msg
set -euo pipefail

IDENT='creo08 <285598642+creo08@users.noreply.github.com>'
BOT_AUTHOR='dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>'
# Split so the address does not count as an added email address in this file.
BOT_COMMITTER='GitHub <noreply''@github.com>'
ALLOWED_EMAIL='285598642+creo08@users.noreply.github.com'
# Split into pieces so this file does not match its own patterns.
FORBIDDEN='Co-Authored''-By:|Claude-Session'':|claude''\.ai/code'
# A letter-only top-level domain keeps "package@1.2.3" from counting as an address.
EMAIL='[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}'

failed=0
err() { echo "hygiene: $*" >&2; failed=1; }

# Prints the added lines of a unified diff read from stdin.
added_lines() { grep -E '^\+' | grep -vE '^\+\+\+ (b/|/dev/null)' || true; }

# Checks text from stdin for forbidden strings; $2=emails also checks addresses.
check_text() {
  local label=$1 mode=${2:-} text bad
  text=$(cat)
  if grep -iEq "$FORBIDDEN" <<<"$text"; then
    err "$label: forbidden trailer or session URL"
    grep -inE "$FORBIDDEN" <<<"$text" | head -5 >&2
  fi
  if [[ $mode == emails ]]; then
    bad=$(grep -oE "$EMAIL" <<<"$text" | grep -vFx "$ALLOWED_EMAIL" | sort -u || true)
    [[ -z $bad ]] || err "$label: email address not allowed: $(tr '\n' ' ' <<<"$bad")"
  fi
  return 0
}

check_ident() {
  local label=$1 ident=$2
  [[ $ident == "$IDENT" ]] || err "$label is '$ident', expected '$IDENT'"
}

if [[ ${1:-} == --commit-msg ]]; then
  [[ -n ${2:-} ]] || { echo "usage: $0 --commit-msg <file>" >&2; exit 2; }
  strip_date() { sed -E 's/ [0-9]+ [+-][0-9]{4}$//'; }
  check_ident author "$(git var GIT_AUTHOR_IDENT | strip_date)"
  check_ident committer "$(git var GIT_COMMITTER_IDENT | strip_date)"
  # Process substitution keeps check_text in this shell, so its errors count.
  check_text "commit message" < <(grep -v '^#' "$2" || true)
  check_text "staged changes" emails < <(git diff --cached --no-color --no-ext-diff | added_lines)
  [[ $failed == 0 ]] || { echo "hygiene: commit rejected" >&2; exit 1; }
  exit 0
fi

[[ $# -gt 0 ]] || { echo "usage: $0 <git rev-list arguments> | --commit-msg <file>" >&2; exit 2; }

git rev-list "$@" >/dev/null # fail closed on a bad revision; mapfile below would hide it
mapfile -t commits < <(git rev-list "$@")
for c in "${commits[@]}"; do
  short=${c:0:12}
  author=$(git log -1 --format='%an <%ae>' "$c")
  committer=$(git log -1 --format='%cn <%ce>' "$c")
  if [[ ${HYGIENE_ALLOW_DEPENDABOT:-} == 1 && $author == "$BOT_AUTHOR" && $committer == "$BOT_COMMITTER" ]]; then
    echo "hygiene: $short by Dependabot, allowed on its own branch"
  else
    check_ident "$short author" "$author"
    check_ident "$short committer" "$committer"
  fi
  check_text "$short message" < <(git log -1 --format=%B "$c")
  check_text "$short files" emails < <(git diff-tree -p -r --root --no-commit-id --no-color --no-ext-diff "$c" | added_lines)
done

if [[ $failed != 0 ]]; then
  echo "hygiene: FAILED (${#commits[@]} commit(s) checked)" >&2
  exit 1
fi
echo "hygiene: ok (${#commits[@]} commit(s) checked)"
