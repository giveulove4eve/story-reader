#!/bin/bash
# Mac 全局划词朗读脚本
# 用法: ./read_selected.sh "需要朗读的文本" 或直接执行从剪贴板读取

TEXT="$1"

# 如果没有参数传入，则尝试从剪贴板读取
if [ -z "$TEXT" ]; then
  TEXT=$(pbpaste)
fi

# 如果还是为空则退出
if [ -z "$TEXT" ]; then
  osascript -e 'display notification "剪贴板中没有发现文字内容" with title "故事朗读器"'
  exit 1
fi

# 提示正在合成
osascript -e 'display notification "正在为您准备讲故事语音..." with title "故事朗读器"'

TMP_MP3="/tmp/story_tts_$(date +%s).mp3"

# 请求本地朗读器后端生成音频 (默认使用晓晓音色)
# 也可以自定义音色，如 zh-CN-YunxiNeural
HTTP_CODE=$(curl -s -w "%{http_code}" -X POST "http://localhost:8000/api/tts" \
  -H "Content-Type: application/json" \
  -d "{\"text\": $(python3 -c "import json, sys; print(json.dumps(sys.argv[1]))" "$TEXT"), \"voice\": \"zh-CN-XiaoxiaoNeural\", \"rate\": 0, \"pitch\": 0}" \
  --output "$TMP_MP3")

if [ "$HTTP_CODE" -eq 200 ] && [ -s "$TMP_MP3" ]; then
  # 停止之前可能正在播放的后台朗读
  killall afplay 2>/dev/null
  # 使用 Mac 自带的 afplay 播放音频
  afplay "$TMP_MP3"
  rm -f "$TMP_MP3"
else
  osascript -e 'display notification "朗读失败，请确保后台服务已启动 (双击 start.command)" with title "故事朗读器"'
  rm -f "$TMP_MP3"
fi
