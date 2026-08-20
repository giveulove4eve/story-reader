#!/bin/bash
# Mac 全局划词朗读脚本 (全应用自适应兼容版)
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$PATH"

TEXT="$1"

# 解决第三方软件（如 Chrome、Word、微信、Notion 等）不主动传递选中文本的问题：
# 如果输入为空，自动模拟 Command + C 抓取当前屏幕高亮选中的文字
if [ -z "$TEXT" ]; then
  # 模拟按下 Command + C
  osascript -e 'tell application "System Events" to keystroke "c" using command down' 2>/dev/null
  sleep 0.2
  TEXT=$(pbpaste 2>/dev/null)
fi

# 如果仍然为空，弹出友好提示
if [ -z "$TEXT" ]; then
  osascript -e 'display notification "请先用鼠标高亮选中文字，再按快捷键" with title "🎙️ 故事朗读器"' 2>/dev/null
  exit 0
fi

# 截取前 30 个字展示在通知里，让用户清楚知道读的是哪段
PREVIEW_TEXT=$(echo "$TEXT" | tr '\n' ' ' | head -c 50 | tr -d '"')
osascript -e "display notification \"准备朗读：${PREVIEW_TEXT}...\" with title \"🎙️ 故事朗读器\"" 2>/dev/null

TMP_MP3="/tmp/story_tts_$(date +%s).mp3"

# 准备 JSON 数据
JSON_PAYLOAD=$(python3 -c "import json, sys; print(json.dumps({'text': sys.argv[1], 'voice': 'zh-CN-XiaoxiaoNeural', 'rate': 0, 'pitch': 0}))" "$TEXT" 2>/dev/null)

if [ -z "$JSON_PAYLOAD" ]; then
  CLEAN_TEXT=$(echo "$TEXT" | tr -d '\n\r"' | head -c 3000)
  JSON_PAYLOAD="{\"text\": \"$CLEAN_TEXT\", \"voice\": \"zh-CN-XiaoxiaoNeural\", \"rate\": 0, \"pitch\": 0}"
fi

# 停止之前正在播放的声音
killall afplay 2>/dev/null

# 请求本地语音服务 (端口 8000)
HTTP_CODE=$(curl -s -m 15 -w "%{http_code}" -X POST "http://localhost:8000/api/tts" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" \
  --output "$TMP_MP3" 2>/dev/null)

if [ "$HTTP_CODE" -eq 200 ] && [ -s "$TMP_MP3" ]; then
  # 使用 Mac 自带高保真音频播放器朗读
  afplay "$TMP_MP3"
  rm -f "$TMP_MP3"
else
  osascript -e 'display notification "语音生成失败，请确认后台服务已开启" with title "故事朗读器"' 2>/dev/null
  rm -f "$TMP_MP3"
fi

exit 0
