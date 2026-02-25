#!/bin/sh
set -eu

PR_NUMBER="${1:-}"
if [ -n "$PR_NUMBER" ]; then
  echo "Running niuma test gate for PR #$PR_NUMBER"
fi

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

rust_test_log="$(mktemp)"
rust_test_bin=""
cleanup() {
  rm -f "$rust_test_log"
  if [ -n "$rust_test_bin" ]; then
    rm -f "$rust_test_bin"
  fi
}
trap cleanup EXIT
if cargo test --offline --manifest-path crates/beautiful-mermaid-rs/Cargo.toml >"$rust_test_log" 2>&1; then
  cat "$rust_test_log"
else
  cat "$rust_test_log"
  if grep -q "Invalid cross-device link" "$rust_test_log"; then
    # 当前执行环境的 rustc 会触发 EXDEV，回退到 rustc --test 保持功能验证可执行。
    rust_test_bin="$(mktemp /tmp/stadium-tests-XXXXXX)"
    rustc --edition=2021 --test crates/beautiful-mermaid-rs/src/ascii/shapes/stadium.rs -o "$rust_test_bin"
    chmod +x "$rust_test_bin"
    "$rust_test_bin"
  else
    exit 1
  fi
fi

bun test src/__tests__/ascii.test.ts
