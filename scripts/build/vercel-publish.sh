#!/usr/bin/env sh
set -eu

# Stage install/uninstall scripts + index page into public/dema for Vercel deploy.
# Runs as the Vercel buildCommand (see vercel.json). Source-of-truth files in
# scripts/install/ are unchanged; this is a deploy-time copy only.
#
# Operator's install path is unaffected: npm install / npm test / npm run check
# never invoke this script. It runs only on Vercel's deploy runner.

mkdir -p public/dema

# Canonical Linux/macOS installer is the unified install.sh (commit 70e3233+).
# install-unix.sh in this repo is a backward-compat wrapper that exec's
# install.sh from the same directory; publishing it standalone would break
# (the wrapper has no sibling install.sh to exec at the published URL).
# Therefore the published /dema/install.sh IS the unified install.sh directly.
cp scripts/install/install.sh            public/dema/install.sh
cp scripts/install/install-windows.ps1   public/dema/install.ps1
cp scripts/install/uninstall-unix.sh     public/dema/uninstall.sh
cp scripts/install/uninstall-windows.ps1 public/dema/uninstall.ps1
cp vercel/index.html                     public/dema/index.html

echo "Staged $(ls public/dema | wc -l) files into public/dema/"
ls -la public/dema
