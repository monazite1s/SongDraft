#!/usr/bin/env bash
# 从仓库根目录加载 .env.production 后启动 standalone（避免 cwd 在 .next/standalone 时读不到 env）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.production ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
elif [[ -f .env.local ]]; then
  echo "[warn] 未找到 .env.production，回退加载 .env.local" >&2
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

if [[ ! -f .next/standalone/server.js ]]; then
  echo "缺少 .next/standalone/server.js，请先 pnpm build" >&2
  exit 1
fi

# standalone 需要 static / public 在其目录内
mkdir -p .next/standalone/.next
if [[ -d .next/static ]]; then
  rm -rf .next/standalone/.next/static
  cp -R .next/static .next/standalone/.next/static
fi
if [[ -d public ]]; then
  rm -rf .next/standalone/public
  cp -R public .next/standalone/public
fi

export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
exec node .next/standalone/server.js
