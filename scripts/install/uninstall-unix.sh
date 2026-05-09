#!/usr/bin/env sh
set -eu

DEMA_HOME="${DEMA_HOME:-$HOME/.dema}"
EXPECTED_PHRASE="REMOVE DEMA LOCAL DATA"

if [ ! -d "$DEMA_HOME" ]; then
  echo "Nothing to uninstall: $DEMA_HOME does not exist."
  exit 0
fi

# Resolve to canonical absolute path (defends against symlinks + relative inputs).
resolved="$(cd "$DEMA_HOME" 2>/dev/null && pwd -P || true)"
if [ -z "$resolved" ]; then
  echo "Refusing to delete: cannot resolve $DEMA_HOME to an absolute path." >&2
  exit 1
fi

# Reject filesystem root.
if [ "$resolved" = "/" ]; then
  echo "Refusing to delete: $resolved is the filesystem root." >&2
  exit 1
fi

# Reject if the resolved path is exactly $HOME.
if [ -n "${HOME:-}" ] && [ "$resolved" = "$HOME" ]; then
  echo "Refusing to delete: $resolved is your home directory." >&2
  exit 1
fi

# Require at least 2 path segments below root (e.g., /home/x or /tmp/y) — defends
# against single-segment system targets like /tmp, /etc, /var, etc.
case "$resolved" in
  /*/*) ;;
  *)
    echo "Refusing to delete: $resolved is too shallow (must be at least 2 levels deep)." >&2
    exit 1
    ;;
esac

echo "Dema uninstall will delete $resolved and all of its contents:"
echo "  receipts/ memory/ logs/ skills/ profile.json config.local.json"
echo ""
echo "This deletes local Dema state on this machine. It is irreversible."
echo ""
echo "Type the exact phrase to confirm (case-sensitive):"
echo "  $EXPECTED_PHRASE"
echo ""
printf "> "
IFS= read -r confirmation

if [ "$confirmation" = "$EXPECTED_PHRASE" ]; then
  rm -rf -- "$resolved"
  echo ""
  echo "Deleted: $resolved"
  echo "Done. Local Dema state removed from this machine."
else
  echo ""
  echo "Phrase did not match. Nothing was deleted."
  exit 1
fi
