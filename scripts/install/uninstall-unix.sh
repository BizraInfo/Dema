#!/usr/bin/env sh
set -eu

DEMA_HOME="${DEMA_HOME:-$HOME/.dema}"
EXPECTED_PHRASE="REMOVE DEMA LOCAL DATA"

if [ ! -d "$DEMA_HOME" ]; then
  echo "Nothing to uninstall: $DEMA_HOME does not exist."
  exit 0
fi

echo "Dema uninstall will delete $DEMA_HOME and all of its contents:"
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
  rm -rf "$DEMA_HOME"
  echo ""
  echo "Deleted: $DEMA_HOME"
  echo "Done. Local Dema state removed from this machine."
else
  echo ""
  echo "Phrase did not match. Nothing was deleted."
  exit 1
fi
