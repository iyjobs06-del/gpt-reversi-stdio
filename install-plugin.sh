#!/bin/bash
set -euo pipefail
[ "$(uname -s)" = Darwin ] || { echo "This installer requires macOS. On Windows use install-plugin.cmd." >&2; exit 2; }
case "$(uname -m)" in arm64|x86_64) ;; *) echo "Unsupported Mac architecture." >&2; exit 2 ;; esac
root="$(cd -- "$(dirname -- "$0")" && pwd)"
codex="$(command -v codex || true)"
if [ -z "$codex" ] && [ -x "$HOME/.codex/plugins/.plugin-appserver/codex" ]; then
  codex="$HOME/.codex/plugins/.plugin-appserver/codex"
fi
[ -n "$codex" ] || { echo "Official local Codex CLI not found. Ask the local chat to locate the existing official CLI; no plugin was registered." >&2; exit 2; }
# A separate generated Mac package leaves the Windows manifest and existing installation untouched.
market="$root/.local/mac-distribution"
plugin="$market/plugins/gpt-reversi-local"
mkdir -p "$plugin/skills/play-reversi" "$market/.agents/plugins"
source="$root/plugins/gpt-reversi-local"
for file in board.html bridge.mjs engine.mjs game.mjs handoff.mjs server.mjs stdio.mjs package.json package-lock.json run-stdio.sh; do
  cp "$source/$file" "$plugin/$file"
done
cp "$source/skills/play-reversi/SKILL.md" "$plugin/skills/play-reversi/SKILL.md"
cat > "$plugin/mcp.json" <<'JSON'
{"$schema":"https://agent-plugins.org/schemas/1.0.0/mcp.schema.json","mcpServers":{"reversi-local":{"type":"stdio","command":"/bin/bash","args":["${PLUGIN_ROOT}/run-stdio.sh"],"cwd":"${PLUGIN_ROOT}"}}}
JSON
cat > "$plugin/plugin.json" <<'JSON'
{"$schema":"https://agent-plugins.org/schemas/1.0.0/plugin.schema.json","name":"gpt-reversi-local","version":"0.2.3","description":"Local stdio Othello, Mac launcher candidate; game code unchanged from 0.2.2.","extensions":{"com.openai":{"requires_local_executor":true,"interface":{"displayName":"GPT対戦オセロ Mac版","shortDescription":"利用者のMacで盤面を動かす接続検証用オセロ","developerName":"GPT連携ゲーム","category":"Productivity","capabilities":["Interactive","Read","Write"],"defaultPrompt":["オセロを開いて。私は黒、あなたは白です。"]}}}}
JSON
cat > "$market/.agents/plugins/marketplace.json" <<'JSON'
{"name":"gpt-game-local-mac","interface":{"displayName":"GPT対戦オセロ Mac配布検証"},"plugins":[{"name":"gpt-reversi-local","source":{"source":"local","path":"./plugins/gpt-reversi-local"},"policy":{"installation":"AVAILABLE","authentication":"ON_INSTALL"},"category":"Productivity"}]}
JSON
/bin/bash "$root/scripts/setup-runtime.sh" "$plugin"
"$codex" plugin marketplace add "$market"
"$codex" plugin add gpt-reversi-local@gpt-game-local-mac
printf '%s\n' 'Installed. Open a new LOCAL chat and select GPT対戦オセロ Mac版.' 'If it is not listed, save your work before restarting the desktop app.'
