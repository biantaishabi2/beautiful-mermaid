#!/usr/bin/env bash
set -euo pipefail

PR_NUMBER="${1:-}"
if [[ -n "$PR_NUMBER" ]]; then
  echo "Running niuma test gate for PR #$PR_NUMBER"
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

rust_test_log="$(mktemp)"
rust_test_bin=""
cleanup() {
  rm -f "$rust_test_log"
  if [[ -n "$rust_test_bin" ]]; then
    rm -f "$rust_test_bin"
  fi
}
trap cleanup EXIT
if cargo test --manifest-path crates/beautiful-mermaid-rs/Cargo.toml 2>&1 | tee "$rust_test_log"; then
  :
elif grep -q "Invalid cross-device link" "$rust_test_log"; then
  # 当前执行环境的 rustc 会触发 EXDEV，回退到 rustc --test 保持功能验证可执行。
  rust_test_bin="$(mktemp /tmp/stadium-tests-XXXXXX)"
  rustc --edition=2021 --test crates/beautiful-mermaid-rs/src/ascii/shapes/stadium.rs -o "$rust_test_bin"
  chmod +x "$rust_test_bin"
  "$rust_test_bin"
else
  exit 1
fi

bun test src/__tests__/ascii.test.ts
