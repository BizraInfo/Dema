#!/usr/bin/env sh
# install-unix.sh · v2.0 · backward-compatibility wrapper for install.sh
#
# The unified installer is `scripts/install/install.sh`. This wrapper
# preserves external references (vercel publish copy, release-readiness
# artifact list, install.bizra.ai/dema endpoint) and delegates to the
# unified script with Node0 default behavior.
#
# All flags pass through. Run `install-unix.sh --help` to see the unified
# installer's full surface.

set -eu
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/install.sh" "$@"
