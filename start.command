#!/bin/bash
cd "$(dirname "$0")"

echo "================================================="
echo "   🎙️ 正在启动 故事朗读器 (Story Voice)...   "
echo "================================================="

# 检查并安装依赖
python3 -m pip install -q -r requirements.txt

# 在后台等待服务就绪后自动打开浏览器
(
  sleep 1.5
  open "http://localhost:8000"
) &

# 启动服务
python3 app.py
