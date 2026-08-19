// 故事朗读器前端交互逻辑

const SAMPLE_TEXTS = {
  story: `森林里有一只骄傲的兔子，它总觉得自己跑得比谁都快。这一天，乌龟慢悠悠地从它身边爬过。兔子捧腹大笑：“乌龟老弟，你走得这么慢，明天早晨也到不了山顶吧！”乌龟停下脚步，微微一笑：“兔子，要不我们来比一场？”兔子胸有成竹地答应了。比赛一开始，兔子像一阵风一样冲了出去，而乌龟只是一步一个脚印，坚定地向前迈进……`,
  novel: `深夜十一点四十分，暴雨倾盆。老式钟楼的钟声穿透了整座小镇的沉寂。林默站在昏暗的窗前，手里的信纸被雨水打湿了一角。信上只有一句话：“他已经回到那座废弃的灯塔了。”就在这时，楼下的木门突然发出了极其细微的吱呀声，紧接着，是一声轻微的脚步声……`,
  prose: `其实生活不需要那么多轰轰烈烈的仪式，一杯刚泡好的热咖啡，窗外掠过的一缕微风，还有一本在午后阳光里翻开的书，就足以温暖一整个平凡的日子。放慢脚步吧，去感受四季的更迭，去倾听内心的声音，生活原本就藏在这些安静而细碎的美好里。`,
  news: `观众朋友们早上好，欢迎收看今天的晨间简讯。据最新科技报道，新一代人工智能语音大模型在情感表达与语境理解方面取得重大突破，机器朗读已具备真人的抑扬顿挫与细腻呼吸感，广泛应用于有声书、播客以及无障碍阅读等多个领域。`
};

let currentVoices = [];
let selectedVoice = "zh-CN-XiaoxiaoNeural";
let currentAudioUrl = null;
let currentAudioBlob = null;
let lastSynthesizedKey = "";
let deferredPrompt = null;

// DOM 元素
const textInput = document.getElementById("text-input");
const textStats = document.getElementById("text-stats");
const voiceGrid = document.getElementById("voice-grid");
const currentVoiceTag = document.getElementById("current-voice-tag");
const activeVoiceName = document.getElementById("active-voice-name");
const rateSlider = document.getElementById("rate-slider");
const rateValue = document.getElementById("rate-value");
const pitchSlider = document.getElementById("pitch-slider");
const pitchValue = document.getElementById("pitch-value");
const btnPlayPause = document.getElementById("btn-play-pause");
const playIcon = document.getElementById("play-icon");
const playStatusText = document.getElementById("play-status-text");
const audioWave = document.getElementById("audio-wave");
const audioPlayer = document.getElementById("audio-player");
const progressBar = document.getElementById("progress-bar");
const progressBarWrap = document.getElementById("progress-bar-wrap");
const currentTimeEl = document.getElementById("current-time");
const totalDurationEl = document.getElementById("total-duration");
const btnRewind = document.getElementById("btn-rewind");
const btnForward = document.getElementById("btn-forward");
const btnDownload = document.getElementById("btn-download");
const btnPaste = document.getElementById("btn-paste");
const btnClear = document.getElementById("btn-clear");
const btnMobileSync = document.getElementById("btn-mobile-sync");
const modalMobile = document.getElementById("modal-mobile");
const btnCloseModal = document.getElementById("btn-close-modal");
const lanUrlText = document.getElementById("lan-url-text");
const btnCopyLan = document.getElementById("btn-copy-lan");
const btnInstallPwa = document.getElementById("btn-install-pwa");

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  fetchServerInfo();
  fetchVoices();
  setupEventListeners();
  updateTextStats();
  
  // 默认填入童话故事示例
  textInput.value = SAMPLE_TEXTS.story;
  updateTextStats();
});

// 获取服务器与局域网 IP
async function fetchServerInfo() {
  try {
    const res = await fetch("/api/info");
    const data = await res.json();
    if (data.lan_url) {
      lanUrlText.textContent = data.lan_url;
    }
  } catch (err) {
    console.warn("获取服务器信息失败", err);
  }
}

// 获取音色列表
async function fetchVoices() {
  try {
    const res = await fetch("/api/voices");
    const data = await res.json();
    currentVoices = data.voices || [];
    renderVoiceGrid(currentVoices);
  } catch (err) {
    console.error("获取音色失败", err);
  }
}

// 渲染音色卡片
function renderVoiceGrid(voices) {
  voiceGrid.innerHTML = "";
  voices.forEach((v) => {
    const card = document.createElement("div");
    card.className = `voice-card ${v.id === selectedVoice ? "active" : ""}`;
    card.dataset.id = v.id;
    card.innerHTML = `
      <div class="voice-card-info">
        <h4>${v.name}</h4>
        <p>${v.description}</p>
      </div>
      <span class="voice-card-tag">${v.tag || v.gender}</span>
    `;

    card.addEventListener("click", () => {
      document.querySelectorAll(".voice-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      selectedVoice = v.id;
      currentVoiceTag.textContent = v.tag || "已选音色";
      activeVoiceName.textContent = v.name;
    });

    voiceGrid.appendChild(card);
  });
}

// 事件绑定
function setupEventListeners() {
  // 文本统计更新
  textInput.addEventListener("input", updateTextStats);

  // 预设示例点击
  document.querySelectorAll(".preset-chips .chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.sample;
      if (SAMPLE_TEXTS[type]) {
        textInput.value = SAMPLE_TEXTS[type];
        updateTextStats();
        // 自动切对应推荐音色
        if (type === "novel") selectVoiceById("zh-CN-YunxiNeural");
        else if (type === "prose") selectVoiceById("zh-CN-XiaoyiNeural");
        else if (type === "news") selectVoiceById("zh-CN-YunjianNeural");
        else selectVoiceById("zh-CN-XiaoxiaoNeural");
      }
    });
  });

  // 剪贴板粘贴与清空
  btnPaste.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        textInput.value = text;
        updateTextStats();
      }
    } catch (e) {
      alert("请直接在输入框中按 Ctrl+V 或 Command+V 粘贴文本");
    }
  });

  btnClear.addEventListener("click", () => {
    textInput.value = "";
    updateTextStats();
  });

  // 滑块事件
  rateSlider.addEventListener("input", () => {
    const val = parseInt(rateSlider.value, 10);
    if (val === 0) rateValue.textContent = "原速 (1.0x)";
    else if (val > 0) rateValue.textContent = `加速 (+${val}%)`;
    else rateValue.textContent = `减速 (${val}%)`;
  });

  pitchSlider.addEventListener("input", () => {
    const val = parseInt(pitchSlider.value, 10);
    if (val === 0) pitchValue.textContent = "标准 (0Hz)";
    else if (val > 0) pitchValue.textContent = `高亢 (+${val}Hz)`;
    else pitchValue.textContent = `低沉 (${val}Hz)`;
  });

  // 播放与暂停
  btnPlayPause.addEventListener("click", handlePlayPause);

  // 音频事件
  audioPlayer.addEventListener("timeupdate", onTimeUpdate);
  audioPlayer.addEventListener("loadedmetadata", () => {
    totalDurationEl.textContent = formatTime(audioPlayer.duration);
  });
  audioPlayer.addEventListener("play", () => {
    playIcon.textContent = "⏸";
    playStatusText.textContent = "正在朗读中...";
    audioWave.classList.remove("hidden");
  });
  audioPlayer.addEventListener("pause", () => {
    playIcon.textContent = "▶";
    playStatusText.textContent = "已暂停";
    audioWave.classList.add("hidden");
  });
  audioPlayer.addEventListener("ended", () => {
    playIcon.textContent = "▶";
    playStatusText.textContent = "朗读完毕";
    audioWave.classList.add("hidden");
    progressBar.style.width = "0%";
    currentTimeEl.textContent = "00:00";
  });

  // 快退 / 快进
  btnRewind.addEventListener("click", () => {
    if (audioPlayer.src) audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 5);
  });
  btnForward.addEventListener("click", () => {
    if (audioPlayer.src) audioPlayer.currentTime = Math.min(audioPlayer.duration || 0, audioPlayer.currentTime + 5);
  });

  // 进度条拖动/点击
  progressBarWrap.addEventListener("click", (e) => {
    if (!audioPlayer.duration) return;
    const rect = progressBarWrap.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = pos * audioPlayer.duration;
  });

  // MP3 下载
  btnDownload.addEventListener("click", () => {
    if (!currentAudioBlob) {
      alert("请先点击播放生成一段语音，然后再下载音频文件");
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(currentAudioBlob);
    a.download = `故事朗读_${new Date().toISOString().slice(0, 10)}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // 手机端连接弹窗
  btnMobileSync.addEventListener("click", () => modalMobile.classList.remove("hidden"));
  btnCloseModal.addEventListener("click", () => modalMobile.classList.add("hidden"));
  modalMobile.querySelector(".modal-backdrop").addEventListener("click", () => modalMobile.classList.add("hidden"));

  btnCopyLan.addEventListener("click", () => {
    navigator.clipboard.writeText(lanUrlText.textContent);
    btnCopyLan.textContent = "已复制 ✓";
    setTimeout(() => (btnCopyLan.textContent = "复制网址"), 2000);
  });

  // PWA 安装提示
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btnInstallPwa.classList.remove("hidden");
  });

  btnInstallPwa.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        btnInstallPwa.classList.add("hidden");
      }
      deferredPrompt = null;
    }
  });
}

function selectVoiceById(id) {
  const card = document.querySelector(`.voice-card[data-id="${id}"]`);
  if (card) card.click();
}

function updateTextStats() {
  const text = textInput.value.trim();
  const count = text.length;
  // 中文一般朗读速度约 220 ~ 260 字/分钟
  const seconds = Math.ceil((count / 240) * 60);
  const timeDesc = seconds >= 60 ? `${Math.floor(seconds / 60)}分${seconds % 60}秒` : `${seconds}秒`;
  textStats.textContent = `${count} 字 · 约 ${timeDesc}`;
}

// 解锁浏览器音频播放权限（针对 Safari / 手机浏览器的自动播放限制）
function unlockAudioContext() {
  if (!audioPlayer.src) {
    // 播放 0.01 秒静音音频，解锁当前 audio 元素的自动播放上下文
    audioPlayer.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
  }
  const p = audioPlayer.play();
  if (p !== undefined) {
    p.then(() => {
      audioPlayer.pause();
    }).catch(() => {
      // 忽略预热阶段的异常
    });
  }
}

async function handlePlayPause() {
  const text = textInput.value.trim();
  if (!text) {
    alert("请先输入或粘贴你想朗读的文字内容！");
    return;
  }

  // 第一时间在用户手势点击的同步阶段激活/解锁音频权限
  unlockAudioContext();

  const rate = parseInt(rateSlider.value, 10);
  const pitch = parseInt(pitchSlider.value, 10);
  const synthesisKey = `${text}_${selectedVoice}_${rate}_${pitch}`;

  // 如果已经加载了当前参数生成的音频，直接切换播放/暂停
  if (synthesisKey === lastSynthesizedKey && audioPlayer.src && audioPlayer.src.startsWith("blob:")) {
    if (audioPlayer.paused) {
      try {
        await audioPlayer.play();
      } catch (err) {
        console.warn("Play error:", err);
      }
    } else {
      audioPlayer.pause();
    }
    return;
  }

  // 开始向后端请求合成
  playStatusText.textContent = "AI 正在酝酿情绪讲故事...";
  playIcon.textContent = "⏳";
  btnPlayPause.disabled = true;

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text,
        voice: selectedVoice,
        rate: rate,
        pitch: pitch
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "生成失败");
    }

    const blob = await response.blob();
    currentAudioBlob = blob;

    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
    }
    currentAudioUrl = URL.createObjectURL(blob);
    audioPlayer.src = currentAudioUrl;
    audioPlayer.load();
    lastSynthesizedKey = synthesisKey;

    try {
      await audioPlayer.play();
    } catch (playErr) {
      // 如果仍被浏览器策略拦截，提示用户直接点击播放按钮
      console.warn("Autoplay blocked, waiting for direct user tap:", playErr);
      playStatusText.textContent = "音频准备完毕，请点击播放 ▶";
      playIcon.textContent = "▶";
    }
  } catch (err) {
    alert(`语音朗读失败: ${err.message}`);
    playStatusText.textContent = "生成遇到问题";
    playIcon.textContent = "▶";
  } finally {
    btnPlayPause.disabled = false;
  }
}


function onTimeUpdate() {
  if (!audioPlayer.duration) return;
  const current = audioPlayer.currentTime;
  const total = audioPlayer.duration;
  const percent = (current / total) * 100;

  progressBar.style.width = `${percent}%`;
  currentTimeEl.textContent = formatTime(current);
}

function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
}

// 注册 Service Worker 满足 PWA 标准
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration skipped:', err);
    });
  });
}

