import os
import socket
import asyncio
import tempfile
from typing import Optional
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.responses import Response, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import edge_tts

app = FastAPI(title="讲故事拟真读词器 API", version="1.0.0")

# 启用 CORS 跨域支持
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 精选高质量拟真音色列表
CURATED_VOICES = [
    {
        "id": "zh-CN-XiaoxiaoNeural",
        "name": "晓晓 (女性 · 生动情感 / 讲故事首选)",
        "gender": "Female",
        "locale": "zh-CN",
        "category": "故事与情感",
        "description": "声音甜美生动，具有极强的情感起伏，非常适合小说、绘本和故事朗读。",
        "tag": "推荐 · 豆包感"
    },
    {
        "id": "zh-CN-YunxiNeural",
        "name": "云希 (男性 · 阳光温暖 / 小说叙述)",
        "gender": "Male",
        "locale": "zh-CN",
        "category": "故事与情感",
        "description": "青年男声，自然富有感染力，适合小说叙述、陪伴聊天和散文。",
        "tag": "推荐 · 叙事感"
    },
    {
        "id": "zh-CN-YunjianNeural",
        "name": "云健 (男性 · 沉稳大气 / 纪录片解说)",
        "gender": "Male",
        "locale": "zh-CN",
        "category": "播报与解说",
        "description": "声音浑厚沉稳，适合历史故事、纪录片旁白、影视解说。",
        "tag": "磁性解说"
    },
    {
        "id": "zh-CN-XiaoyiNeural",
        "name": "晓伊 (女性 · 温柔舒缓 / 情感电台)",
        "gender": "Female",
        "locale": "zh-CN",
        "category": "故事与情感",
        "description": "声音轻柔温和，适合睡前故事、抒情散文、心灵电台。",
        "tag": "温柔治愈"
    },
    {
        "id": "zh-CN-YunyangNeural",
        "name": "云扬 (男性 · 专业播报 / 新闻资讯)",
        "gender": "Male",
        "locale": "zh-CN",
        "category": "播报与解说",
        "description": "字正腔圆，适合新闻播报、商业资讯、正式演讲。",
        "tag": "专业主持"
    },
    {
        "id": "zh-CN-liaoning-XiaobeiNeural",
        "name": "晓北 (女性 · 东北口音 / 趣味活泼)",
        "gender": "Female",
        "locale": "zh-CN",
        "category": "特色方言",
        "description": "带有亲切生动的东北口音，适合搞笑段子、生活短剧。",
        "tag": "幽默风趣"
    },
    {
        "id": "zh-TW-HsiaoChenNeural",
        "name": "晓臻 (女性 · 台湾国语 / 轻柔甜美)",
        "gender": "Female",
        "locale": "zh-TW",
        "category": "特色方言",
        "description": "台湾国语发音，亲切甜美，适合清新文艺类内容。",
        "tag": "台湾腔"
    },
    {
        "id": "zh-HK-HiuMaanNeural",
        "name": "晓曼 (女性 · 粤语 / 生动自然)",
        "gender": "Female",
        "locale": "zh-HK",
        "category": "特色方言",
        "description": "地道粤语母语发音，自然流畅，适合粤语故事与文章。",
        "tag": "地道粤语"
    },
    {
        "id": "en-US-JennyNeural",
        "name": "Jenny (美音女声 · 自然随和)",
        "gender": "Female",
        "locale": "en-US",
        "category": "英语精选",
        "description": "标准美式英语发音，富有表现力。",
        "tag": "英语母语"
    },
    {
        "id": "en-US-GuyNeural",
        "name": "Guy (美音男声 · 沉稳叙事)",
        "gender": "Male",
        "locale": "en-US",
        "category": "英语精选",
        "description": "美式男声旁白，适合英文故事与演讲。",
        "tag": "英文叙事"
    }
]

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "zh-CN-XiaoxiaoNeural"
    rate: Optional[int] = 0        # -50 到 +100 (百分比)
    pitch: Optional[int] = 0       # -50 到 +50 (Hz)
    volume: Optional[int] = 0      # -50 到 +50 (百分比)

def get_local_ip():
    """获取本机在局域网中的 IP 地址（方便手机同局域网访问）"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # 连接一个不需要实际可达的公网 IP 即可探测出本机网卡 IP
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

@app.get("/api/info")
async def get_server_info():
    """获取服务器基本信息及局域网访问地址"""
    local_ip = get_local_ip()
    return {
        "status": "running",
        "local_url": "http://localhost:8000",
        "lan_url": f"http://{local_ip}:8000",
        "local_ip": local_ip
    }

@app.get("/api/voices")
async def get_voices():
    """获取预设的拟真音色列表"""
    return {"voices": CURATED_VOICES}

@app.post("/api/tts")
async def synthesize_speech(req: TTSRequest):
    """根据文本生成高拟真语音音频 (MP3)"""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="文本内容不能为空")

    if len(text) > 10000:
        raise HTTPException(status_code=400, detail="单次朗读文字长度请控制在 10000 字以内")

    # 转换语速、音调格式 (+0%, +15%, -10Hz 等)
    rate_str = f"{'+' if req.rate >= 0 else ''}{req.rate}%"
    pitch_str = f"{'+' if req.pitch >= 0 else ''}{req.pitch}Hz"
    volume_str = f"{'+' if req.volume >= 0 else ''}{req.volume}%"

    try:
        communicate = edge_tts.Communicate(
            text=text,
            voice=req.voice or "zh-CN-XiaoxiaoNeural",
            rate=rate_str,
            pitch=pitch_str,
            volume=volume_str
        )

        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])

        audio_bytes = b"".join(audio_chunks)
        if not audio_bytes:
            raise HTTPException(status_code=500, detail="未能生成有效音频，请检查输入或网络连接")

        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "Cache-Control": "no-cache"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"语音合成失败: {str(e)}")

# 挂载静态资源前端页面
static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir, exist_ok=True)

app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    local_ip = get_local_ip()
    print("=" * 60)
    print(" 📖 讲故事拟真读词器已启动！")
    print(f" 💻 本机访问:       http://localhost:{port}")
    print(f" 📱 局域网访问:     http://{local_ip}:{port}")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=port)

