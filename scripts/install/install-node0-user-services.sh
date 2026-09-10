#!/usr/bin/env bash
# Install the existing Node0 runtime and DEMA front door as loopback-only
# systemd user services. This creates no identity, consent, or authority.

set -eu
umask 077

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
DEMA_HOME="${DEMA_HOME:-$HOME/.dema}"
ROOTS_DIR="${DEMA_ROOTS_DIR:-$REPO_ROOT/root-dna}"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
MODE=""

usage() {
  echo "Usage: $0 --render|--install|--uninstall [--dema-home PATH] [--roots-dir PATH] [--unit-dir PATH]"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --render|--install|--uninstall)
      if [ -n "$MODE" ]; then echo "ERROR: choose exactly one mode" >&2; exit 2; fi
      MODE=${1#--}; shift ;;
    --dema-home) DEMA_HOME=${2:-}; shift 2 ;;
    --roots-dir) ROOTS_DIR=${2:-}; shift 2 ;;
    --unit-dir) UNIT_DIR=${2:-}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown flag: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ -z "$MODE" ]; then
  echo "ERROR: choose exactly one of --render, --install, or --uninstall" >&2
  exit 2
fi

safe_path() {
  case "$1" in
    ""|/|/*[!A-Za-z0-9_./:@+-]*|[!/]*) return 1 ;;
    *) return 0 ;;
  esac
}

for path in "$REPO_ROOT" "$DEMA_HOME" "$ROOTS_DIR" "$UNIT_DIR"; do
  if ! safe_path "$path"; then
    echo "ERROR: unsupported service path: $path" >&2
    exit 2
  fi
done

BACKEND_UNIT="$UNIT_DIR/bizra-urp-genesis-dema-bridge.service"
UI_UNIT="$UNIT_DIR/dema-homebase.service"

if [ "$MODE" = "uninstall" ]; then
  for unit in "$BACKEND_UNIT" "$UI_UNIT"; do
    if [ -f "$unit" ] && ! grep -q '^# BIZRA_NODE0_LIGHTHOUSE_MANAGED=1$' "$unit"; then
      echo "ERROR: refusing to remove unmanaged unit: $unit" >&2
      exit 1
    fi
  done
  if command -v systemctl >/dev/null 2>&1; then
    systemctl --user disable --now dema-homebase.service bizra-urp-genesis-dema-bridge.service >/dev/null 2>&1 || true
  fi
  rm -f "$BACKEND_UNIT" "$UI_UNIT"
  command -v systemctl >/dev/null 2>&1 && systemctl --user daemon-reload || true
  echo "Node0 user services removed; local state preserved at $DEMA_HOME"
  exit 0
fi

if [ "$MODE" = "install" ] && ! command -v systemctl >/dev/null 2>&1; then
  echo "ERROR: systemctl is required for --install; use --render to inspect units" >&2
  exit 2
fi

NODE_BIN=$(command -v node || true)
if [ -z "$NODE_BIN" ]; then
  echo "ERROR: Node.js 20 or newer is required" >&2
  exit 2
fi
NODE_MAJOR=$($NODE_BIN -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERROR: Node.js 20 or newer is required" >&2
  exit 2
fi
if [ ! -f "$DEMA_HOME/profile.json" ]; then
  echo "ERROR: run scripts/install/install.sh before installing services" >&2
  exit 2
fi
if [ ! -f "$REPO_ROOT/packages/dema-ui/.next/standalone/packages/dema-ui/server.js" ]; then
  echo "ERROR: build packages/dema-ui before installing services" >&2
  exit 2
fi

DEMA_ROOTS_DIR="$ROOTS_DIR" BIZRA_SERVICE_REPO_ROOT="$REPO_ROOT" "$NODE_BIN" --input-type=module -e '
  import { join } from "node:path";
  import { pathToFileURL } from "node:url";
  const root = process.env.BIZRA_SERVICE_REPO_ROOT;
  const gatherer = await import(pathToFileURL(join(root, "apps/cli/src/commands/identity-root-gatherer.js")));
  const canon = await import(pathToFileURL(join(root, "packages/core/src/dema-identity-root-canon.js")));
  const measured = gatherer.readIdentityRoots();
  if (!measured.ok) throw new Error(measured.error);
  const result = canon.buildDemaIdentityRootCanon({ root_files: measured.root_files });
  if (result.rejected) throw new Error(result.reason_code);
' >/dev/null

COMPILER_HASH="sha256:$(sha256sum "$REPO_ROOT/packages/core/src/bizra-prompt-compiler.js" | cut -d' ' -f1)"
CAMPAIGN_ROOT="$DEMA_HOME/campaigns/node0-genesis-v1"
mkdir -p "$UNIT_DIR"

BACKEND_BODY="# BIZRA_NODE0_LIGHTHOUSE_MANAGED=1
[Unit]
Description=BIZRA Node0 governed DEMA mission adapter
After=default.target

[Service]
Type=simple
WorkingDirectory=$REPO_ROOT
ExecStart=$NODE_BIN $REPO_ROOT/scripts/genesis-node0.mjs --no-ui --dema-bridge
Environment=DEMA_HOME=$DEMA_HOME
Environment=GENESIS_API_PORT=4301
Restart=on-failure
RestartSec=3
UMask=0077
MemoryMax=2G
TasksMax=512
LimitNOFILE=8192
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$DEMA_HOME
ProtectKernelTunables=yes
ProtectControlGroups=yes
ProtectHostname=yes
LockPersonality=yes
RestrictSUIDSGID=yes
RestrictRealtime=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
IPAddressDeny=any
IPAddressAllow=127.0.0.0/8
IPAddressAllow=::1/128
SystemCallArchitectures=native

[Install]
WantedBy=default.target"

UI_BODY="# BIZRA_NODE0_LIGHTHOUSE_MANAGED=1
[Unit]
Description=DEMA local Node0 front door
After=bizra-urp-genesis-dema-bridge.service
Wants=bizra-urp-genesis-dema-bridge.service

[Service]
Type=simple
WorkingDirectory=$REPO_ROOT/packages/dema-ui
ExecStart=$NODE_BIN $REPO_ROOT/packages/dema-ui/.next/standalone/packages/dema-ui/server.js
Environment=HOSTNAME=127.0.0.1
Environment=PORT=3000
Environment=DEMA_HOME=$DEMA_HOME
Environment=BIZRA_FOUNDER_DEMA_HOME=$DEMA_HOME
Environment=BIZRA_GENESIS_CAMPAIGN_ROOT=$CAMPAIGN_ROOT
Environment=BIZRA_PROMPT_COMPILER_CODE_HASH=$COMPILER_HASH
Environment=BIZRA_NODE0_GOVERNED_RUNTIME_URL=http://127.0.0.1:4301
Environment=BIZRA_NODE0_MISSION_ROOT=$DEMA_HOME
Environment=BIZRA_NODE0_ROOTS_DIR=$ROOTS_DIR
Restart=on-failure
RestartSec=3
UMask=0077
MemoryMax=2G
TasksMax=512
LimitNOFILE=8192
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$DEMA_HOME
ProtectKernelTunables=yes
ProtectControlGroups=yes
ProtectHostname=yes
LockPersonality=yes
RestrictSUIDSGID=yes
RestrictRealtime=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
IPAddressDeny=any
IPAddressAllow=127.0.0.0/8
IPAddressAllow=::1/128
SystemCallArchitectures=native

[Install]
WantedBy=default.target"

write_unit() {
  target=$1
  body=$2
  if [ -f "$target" ] && [ "$(cat "$target")" != "$body" ]; then
    echo "ERROR: refusing to overwrite different unit: $target" >&2
    exit 1
  fi
  printf '%s\n' "$body" > "$target"
}

write_unit "$BACKEND_UNIT" "$BACKEND_BODY"
write_unit "$UI_UNIT" "$UI_BODY"

if [ "$MODE" = "render" ]; then
  echo "Rendered loopback-only Node0 user services in $UNIT_DIR"
  exit 0
fi

mkdir -p "$CAMPAIGN_ROOT/receipts"
systemctl --user daemon-reload
systemctl --user enable --now bizra-urp-genesis-dema-bridge.service dema-homebase.service

"$NODE_BIN" -e '
  const urls = ["http://127.0.0.1:4301/readyz", "http://127.0.0.1:3000/mission"];
  const deadline = Date.now() + 90000;
  for (const url of urls) {
    for (;;) {
      try { const response = await fetch(url); if (response.status < 500) break; } catch {}
      if (Date.now() >= deadline) throw new Error(`readiness_timeout:${url}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
' 
echo "Node0 user services installed and loopback readiness observed"
