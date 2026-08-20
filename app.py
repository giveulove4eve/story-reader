import os
import re
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

# 精选高质量拟真音色列表 (置顶最像豆包的灵动活泼人声音色)
CURATED_VOICES = [
    {
        "id": "zh-CN-XiaoyiNeural",
        "name": "晓伊 (豆包·灵动少女 / 像真人讲故事)",
        "gender": "Female",
        "locale": "zh-CN",
        "category": "故事与情感",
        "description": "极具豆包感，语气轻快俏皮，情绪起伏生动，就像身边的活泼女孩在讲故事。",
        "tag": "👑 最像豆包 · 推荐",
        "default_rate": 12,
        "default_pitch": 5
    },
    {
        "id": "zh-TW-HsiaoChenNeural",
        "name": "晓晨 (豆包·甜美互动 / 超高真人感)",
        "gender": "Female",
        "locale": "zh-TW",
        "category": "故事与情感",
        "description": "真实自然的说话咬字与微嗲甜美感，语气自然微扬，完全摆脱机器死板味。",
        "tag": "💖 极度逼真 · 推荐",
        "default_rate": 10,
        "default_pitch": 4
    },
    {
        "id": "zh-CN-XiaoxiaoNeural",
        "name": "晓晓 (女性 · 讲故事 / 灵动调校版)",
        "gender": "Female",
        "locale": "zh-CN",
        "category": "故事与情感",
        "description": "经典讲故事女声，经过灵动调校，抑扬顿挫，深情生动。",
        "tag": "📖 故事绘本",
        "default_rate": 10,
        "default_pitch": 5
    },
    {
        "id": "zh-CN-YunxiNeural",
        "name": "云希 (男性 · 阳光温暖 / 小说叙事)",
        "gender": "Male",
        "locale": "zh-CN",
        "category": "故事与情感",
        "description": "青年男声，自然富有感染力，适合小说叙述、陪伴聊天和散文。",
        "tag": "🌟 男声首选",
        "default_rate": 5,
        "default_pitch": 0
    },
    {
        "id": "zh-CN-YunjianNeural",
        "name": "云健 (男性 · 沉稳大气 / 纪录片解说)",
        "gender": "Male",
        "locale": "zh-CN",
        "category": "播报与解说",
        "description": "声音浑厚沉稳，适合历史故事、纪录片旁白、影视解说。",
        "tag": "🎙️ 磁性解说",
        "default_rate": 0,
        "default_pitch": 0
    },
    {
        "id": "zh-TW-HsiaoYuNeural",
        "name": "晓涵 (女性 · 温柔知性 / 陪伴治愈)",
        "gender": "Female",
        "locale": "zh-TW",
        "category": "故事与情感",
        "description": "恬静舒缓，适合抒情散文、睡前故事、心灵治愈。",
        "tag": "☕ 温柔陪伴",
        "default_rate": 5,
        "default_pitch": 2
    },
    {
        "id": "zh-CN-YunxiaNeural",
        "name": "云夏 (少年 · 萌趣活泼 / 正太少年)",
        "gender": "Male",
        "locale": "zh-CN",
        "category": "故事与情感",
        "description": "活泼可爱，元气满满，适合童话与动漫故事。",
        "tag": "⚡ 活力少年",
        "default_rate": 8,
        "default_pitch": 4
    },
    {
        "id": "zh-CN-YunyangNeural",
        "name": "云扬 (男性 · 专业播报 / 新闻资讯)",
        "gender": "Male",
        "locale": "zh-CN",
        "category": "播报与解说",
        "description": "字正腔圆，适合新闻播报、商业资讯、正式演讲。",
        "tag": "专业主持",
        "default_rate": 0,
        "default_pitch": 0
    }
]

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "zh-CN-XiaoyiNeural"
    rate: Optional[int] = 10  # 默认 +10% 带来豆包般的轻快节奏
    pitch: Optional[int] = 5  # 默认 +5Hz 带来灵动的少女音调
    volume: Optional[int] = 0

def optimize_conversational_text(text: str) -> str:
    """智能优化文本呼吸感与连读节奏"""
    # 连贯化 PDF 换行
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    cleaned = " ".join(lines)
    # 将机械化长破折号或连续点转为自然停顿逗号
    cleaned = re.sub(r'—{2,}', '，', cleaned)
    cleaned = re.sub(r'\.{3,}', '，', cleaned)
    cleaned = re.sub(r'…{2,}', '，', cleaned)
    return cleaned

def get_local_ip():
    """获取本机局域网 IP 地址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
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
    raw_text = req.text.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="文本内容不能为空")

    if len(raw_text) > 15000:
        raise HTTPException(status_code=400, detail="单次朗读文字长度请控制在 15000 字以内")

    # 智能口语节奏优化
    text = optimize_conversational_text(raw_text)

    # 转换语速、音调格式 (+10%, +5Hz 等)
    rate_str = f"{'+' if req.rate >= 0 else ''}{req.rate}%"
    pitch_str = f"{'+' if req.pitch >= 0 else ''}{req.pitch}Hz"
    volume_str = f"{'+' if req.volume >= 0 else ''}{req.volume}%"

    try:
        communicate = edge_tts.Communicate(
            text=text,
            voice=req.voice or "zh-CN-XiaoyiNeural",
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
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"语音合成失败: {str(e)}")

# 挂载静态资源目录
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
