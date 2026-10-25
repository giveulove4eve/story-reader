#!/bin/bash
cd "$(dirname "$0")"

echo "================================================="
echo "   🎙️ 正在启动 故事朗读器 (Story Voice)...   "
echo "================================================="

# 优先使用已安装 edge-tts 7.3.1 的 Python 3.10 环境
if [ -x "/Library/Frameworks/Python.framework/Versions/3.10/bin/python3" ]; then
    PYTHON_EXEC="/Library/Frameworks/Python.framework/Versions/3.10/bin/python3"
else
    PYTHON_EXEC="python3"
fi

# 检查并安装依赖
"$PYTHON_EXEC" -m pip install -q -r requirements.txt

# 在后台等待服务就绪后自动打开浏览器
(
  sleep 1.5
  open "http://localhost:8000"
) &

# 启动服务
"$PYTHON_EXEC" app.py
