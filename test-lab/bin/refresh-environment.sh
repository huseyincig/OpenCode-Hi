#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LAB="$ROOT/test-lab"
mkdir -p "$LAB/runtime/environment"
{
  echo "captured_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "opencode_binary=$(command -v opencode)"
  echo "opencode_version=$(opencode --version)"
  echo "npm_opencode_ai_latest=$(npm view opencode-ai version)"
  echo "npm_sdk_latest=$(npm view @opencode-ai/sdk version)"
} > "$LAB/runtime/environment/host.txt"
opencode models opencode-go --refresh > "$LAB/runtime/environment/models-opencode-go.txt"
opencode models opencode --refresh > "$LAB/runtime/environment/models-opencode.txt"
echo "$LAB/runtime/environment"
