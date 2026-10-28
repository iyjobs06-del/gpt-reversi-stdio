#!/bin/bash
set -euo pipefail
[ "$(uname -s)" = Darwin ] || { echo "This launcher requires macOS." >&2; exit 2; }
case "$(uname -m)" in arm64) arch=arm64 ;; x86_64) arch=x64 ;; *) echo "Unsupported Mac architecture." >&2; exit 2 ;; esac
root="$(cd -- "$(dirname -- "$0")" && pwd)"
node="$root/.runtime/node-v24.19.0-darwin-$arch/bin/node"
[ -x "$node" ] || { echo "Run install-plugin.sh first." >&2; exit 1; }
exec "$node" "$root/stdio.mjs"
