#!/bin/bash
# arch-guardian: 变更影响速检 hook
# 在 git commit 执行前触发，对本次提交的变更集执行架构速检

INPUT=$(cat)

# 提取 Bash 命令内容
COMMAND=$(echo "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)

# 仅匹配 git commit 命令（排除 amend、message-only 等无实际变更的情况）
case "$COMMAND" in
  *git\ commit*) ;;
  *) exit 0 ;;
esac

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "请调用 arch-guardian 技能，执行「变更影响速检」模式。即将执行 git commit，请对暂存区的变更进行架构影响分析。"
  }
}
EOF
