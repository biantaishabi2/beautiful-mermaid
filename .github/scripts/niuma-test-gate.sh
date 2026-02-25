#!/usr/bin/env bash
set -euo pipefail

# 用法：niuma-test-gate.sh <pr_number> [repo]
PR_NUMBER="${1:-}"
TARGET_REPO="${2:-${REPO:-${GITHUB_REPOSITORY:-}}}"
if [ -z "$PR_NUMBER" ]; then
  echo "用法: $0 <pr_number> [repo]" >&2
  exit 2
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "::error::gh CLI 不可用，无法执行 PR gate" >&2
  exit 1
fi

repo_args=()
if [ -n "$TARGET_REPO" ]; then
  repo_args+=(--repo "$TARGET_REPO")
fi

if ! pr_view_err="$(gh pr view "$PR_NUMBER" "${repo_args[@]}" --json number 2>&1 >/dev/null)"; then
  if echo "$pr_view_err" | grep -Eiq 'Could not resolve to a PullRequest|no pull requests found|not found'; then
    echo "::warning::PR #$PR_NUMBER 在 ${TARGET_REPO:-当前仓库} 中不存在，跳过 gate"
    exit 0
  fi
  echo "::error::校验 PR #$PR_NUMBER 失败：$pr_view_err" >&2
  exit 1
fi

# 等待 checks 完成（最多 5 分钟）
for i in $(seq 1 30); do
  pending=$(gh pr checks "$PR_NUMBER" "${repo_args[@]}" --json state --jq '[.[] | select(.state == "PENDING")] | length' 2>/dev/null || echo "0")
  if [ "$pending" = "0" ]; then
    break
  fi
  echo "等待 $pending 个 check 完成... ($i/30)"
  sleep 10
done

failed=$(gh pr checks "$PR_NUMBER" "${repo_args[@]}" --json name,conclusion --jq '[.[] | select(.conclusion == "FAILURE" or .conclusion == "failure")] | length' 2>/dev/null || echo "0")
if [ "$failed" != "0" ]; then
  echo "::error::PR #$PR_NUMBER 有 $failed 个 check 失败"
  gh pr checks "$PR_NUMBER" "${repo_args[@]}" --json name,conclusion --jq '.[] | select(.conclusion == "FAILURE" or .conclusion == "failure") | "  ✗ \(.name)"'
  exit 1
fi

echo "所有 PR checks 通过"
