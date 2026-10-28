#!/bin/bash
set -euo pipefail
[ "$(uname -s)" = Darwin ] || { echo "This setup requires macOS." >&2; exit 2; }
case "$(uname -m)" in
  arm64) arch=arm64; hash=8294b7aa9b03997481c06babf1e8b270c859358f27da57a11509afe537ac381d ;;
  x86_64) arch=x64; hash=d1b5e999db158c62fe8f7267a4476b035d8bd93b1a605bac24a3f0dd166e3316 ;;
  *) echo "Unsupported Mac architecture." >&2; exit 2 ;;
esac
plugin="$1"
runtime="$plugin/.runtime"
name="node-v24.19.0-darwin-$arch"
mkdir -p "$runtime"
archive="$runtime/$name.tar.gz"
if [ ! -f "$archive" ]; then
  curl --fail --location --silent --show-error "https://nodejs.org/dist/v24.19.0/$name.tar.gz" -o "$archive.part"
  printf '%s  %s\n' "$hash" "$archive.part" | shasum -a 256 -c -
  mv "$archive.part" "$archive"
fi
printf '%s  %s\n' "$hash" "$archive" | shasum -a 256 -c -
tar -xzf "$archive" -C "$runtime"
node="$runtime/$name/bin/node"
cd "$plugin"
"$node" "$runtime/$name/lib/node_modules/npm/bin/npm-cli.js" ci --ignore-scripts --no-audit --no-fund --cache "$runtime/npm-cache"
