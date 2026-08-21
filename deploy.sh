#!/bin/bash
# 自动化一键推送 GitHub 并触发 Render 云端部署
set -e

COMMIT_MSG="${1:-Update story reader features}"

echo "📦 正在暂存本地更改..."
git add .

echo "📝 正在生成 Commit: $COMMIT_MSG..."
git commit -m "$COMMIT_MSG" || true

echo "🚀 正在推送至 GitHub 仓库..."
git push origin main

echo "⚡ 正在触发 Render 云端极速构建..."
curl -s -X POST "https://api.render.com/deploy/srv-da306p7lk1mc73f4siu0?key=KXaa-gfxrTw"

echo ""
echo "🎉 100% 全自动部署已触发！Render 云端将在 30~60 秒内自动编译上线！"
