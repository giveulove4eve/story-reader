// 配置本地 PDF.js worker
function initPdfJs() {
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
  }
}
initPdfJs();


const SAMPLE_TEXTS = {
  story: `森林里有一只骄傲的兔子，它总觉得自己跑得比谁都快。这一天，乌龟慢悠悠地从它身边爬过。兔子捧腹大笑：“乌龟老弟，你走得这么慢，明天早晨也到不了山顶吧！”乌龟停下脚步，微微一笑：“兔子，要不我们来比一场？”兔子胸有成竹地答应了。比赛一开始，兔子像一阵风一样冲了出去，而乌龟只是一步一个脚印，坚定地向前迈进……`,
  novel: `深夜十一点四十分，暴雨倾盆。老式钟楼的钟声穿透了整座小镇的沉寂。林默站在昏暗的窗前，手里的信纸被雨水打湿了一角。信上只有一句话：“他已经回到那座废弃的灯塔了。”就在这时，楼下的木门突然发出了极其细微的吱呀声，紧接着，是一声轻微的脚步声……`,
  prose: `其实生活不需要那么多轰轰烈烈的仪式，一杯刚泡好的热咖啡，窗外掠过的一缕微风，还有一本在午后阳光里翻开的书，就足以温暖一整个平凡的日子。放慢脚步吧，去感受四季的更迭，去倾听内心的声音，生活原本就藏在这些安静而细碎的美好里。`,
  news: `观众朋友们早上好，欢迎收看今天的晨间简讯。据最新科技报道，新一代人工智能语音大模型在情感表达与语境理解方面取得重大突破，机器朗读已具备真人的抑扬顿挫与细腻呼吸感，广泛应用于有声书、播客以及无障碍阅读等多个领域。`
};

let currentVoices = [];
let selectedVoice = "zh-CN-XiaoyiNeural";
let currentAudioUrl = null;
let currentAudioBlob = null;
let lastSynthesizedKey = "";
let deferredPrompt = null;


// PDF 电子书状态
let currentPdfDoc = null;
let currentPdfPage = 1;
let totalPdfPages = 0;
let currentPdfName = "";
let autoPageTimer = null;

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

// PDF 相关 DOM
const btnUploadPdf = document.getElementById("btn-upload-pdf");
const pdfFileInput = document.getElementById("pdf-file-input");
const pdfToolbar = document.getElementById("pdf-toolbar");
const pdfBookTitle = document.getElementById("pdf-book-title");
const btnPrevPage = document.getElementById("btn-prev-page");
const btnNextPage = document.getElementById("btn-next-page");
const pdfPageNum = document.getElementById("pdf-page-num");
const pdfTotalPages = document.getElementById("pdf-total-pages");
const pdfAutoContinue = document.getElementById("pdf-auto-continue");
const btnClosePdf = document.getElementById("btn-close-pdf");
const presetsContainer = document.getElementById("presets-container");

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  fetchServerInfo();
  fetchVoices();
  setupEventListeners();
  setupPdfHandlers();
  
  // 默认应用豆包灵动轻快参数 (+12% 语速, +5Hz 音调)
  rateSlider.value = 12;
  updateRateDisplay(12);
  pitchSlider.value = 5;
  updatePitchDisplay(5);
  activeVoiceName.textContent = "晓伊 (豆包·灵动少女 / 像真人讲故事)";
  currentVoiceTag.textContent = "👑 豆包活泼感 · 推荐";
  
  // 默认填入童话故事示例
  textInput.value = SAMPLE_TEXTS.story;
  updateTextStats();
});


// 获取服务器与局域网 / 公网地址
async function fetchServerInfo() {
  if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    lanUrlText.textContent = window.location.origin;
    return;
  }
  try {
    const res = await fetch("/api/info");
    const data = await res.json();
    if (data.lan_url) {
      lanUrlText.textContent = data.lan_url;
    }
  } catch (err) {
    lanUrlText.textContent = window.location.origin;
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

      // 自动切换为该音色专属的最佳人声语速和语调调校
      if (v.default_rate !== undefined) {
        rateSlider.value = v.default_rate;
        updateRateDisplay(v.default_rate);
      }
      if (v.default_pitch !== undefined) {
        pitchSlider.value = v.default_pitch;
        updatePitchDisplay(v.default_pitch);
      }
    });

    voiceGrid.appendChild(card);
  });
}

function updateRateDisplay(val) {
  if (val === 0) rateValue.textContent = "原速 (1.0x)";
  else if (val > 0) rateValue.textContent = `轻快 (+${val}%)`;
  else rateValue.textContent = `减速 (${val}%)`;
}

function updatePitchDisplay(val) {
  if (val === 0) pitchValue.textContent = "标准 (0Hz)";
  else if (val > 0) pitchValue.textContent = `微扬灵动 (+${val}Hz)`;
  else pitchValue.textContent = `低沉 (${val}Hz)`;
}


// PDF 电子书处理逻辑
function setupPdfHandlers() {
  // 文件选择变更 (由于使用原生 <label for="pdf-file-input">，无需在 JS 中重复调用 .click())
  pdfFileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      processPdfFile(file);
    }
  });

  // 支持直接将 PDF 拖拽到页面
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith(".pdf")) {
        processPdfFile(file);
      }
    }
  });

  // 翻页操作
  btnPrevPage.addEventListener("click", () => {
    if (currentPdfDoc && currentPdfPage > 1) {
      loadPdfPage(currentPdfPage - 1, false);
    }
  });

  btnNextPage.addEventListener("click", () => {
    if (currentPdfDoc && currentPdfPage < totalPdfPages) {
      loadPdfPage(currentPdfPage + 1, false);
    }
  });

  // 页码跳转输入
  pdfPageNum.addEventListener("change", () => {
    let page = parseInt(pdfPageNum.value, 10);
    if (isNaN(page)) page = 1;
    page = Math.max(1, Math.min(totalPdfPages, page));
    pdfPageNum.value = page;
    if (currentPdfDoc) {
      loadPdfPage(page, false);
    }
  });

  pdfPageNum.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      pdfPageNum.blur();
    }
  });

  // 关闭 PDF 模式
  btnClosePdf.addEventListener("click", () => {
    currentPdfDoc = null;
    totalPdfPages = 0;
    currentPdfPage = 1;
    pdfToolbar.classList.add("hidden");
    presetsContainer.classList.remove("hidden");
    pdfFileInput.value = "";
    if (autoPageTimer) clearTimeout(autoPageTimer);
    textInput.value = SAMPLE_TEXTS.story;
    updateTextStats();
  });
}

// 解析 PDF 文件
function processPdfFile(file) {
  initPdfJs();

  if (!window.pdfjsLib) {
    alert("PDF 解析引擎正在初始化，请稍候 1 秒再试...");
    return;
  }

  // 立即给用户最显眼的视觉反馈：展开控制栏并显示书名与正在加载
  pdfToolbar.classList.remove("hidden");
  presetsContainer.classList.add("hidden");
  pdfBookTitle.textContent = file.name;
  pdfTotalPages.textContent = "解析中...";
  pdfPageNum.value = 1;
  playStatusText.textContent = `📖 正在读取《${file.name}》...`;

  const reader = new FileReader();

  reader.onprogress = function(event) {
    if (event.lengthComputable) {
      const percent = Math.round((event.loaded / event.total) * 100);
      playStatusText.textContent = `📖 正在读取《${file.name}》(${percent}%)...`;
    }
  };

  reader.onload = async function(e) {
    try {
      playStatusText.textContent = `📖 正在解析文档结构...`;
      const typedArray = new Uint8Array(e.target.result);
      const loadingTask = pdfjsLib.getDocument({ data: typedArray });
      
      currentPdfDoc = await loadingTask.promise;
      totalPdfPages = currentPdfDoc.numPages;
      currentPdfName = file.name;
      currentPdfPage = 1;

      // 更新页数
      pdfTotalPages.textContent = totalPdfPages;
      pdfPageNum.max = totalPdfPages;
      pdfPageNum.value = 1;

      // 提取第 1 页内容
      await loadPdfPage(1, false);

      // 重置 input 以便下次可以重新选择同名文件
      if (pdfFileInput) pdfFileInput.value = "";
    } catch (err) {
      console.error("PDF 解析失败:", err);
      alert(`解析 PDF 失败: ${err.message}\n请确认该文件是否为标准未加密的 PDF 文件。`);
      playStatusText.textContent = "解析 PDF 出错";
      pdfTotalPages.textContent = "0";
    }
  };

  reader.onerror = function() {
    alert("读取文件失败，请检查文件权限或重试");
    playStatusText.textContent = "读取文件失败";
  };

  reader.readAsArrayBuffer(file);
}



// 提取指定页码的文本
async function loadPdfPage(pageNum, autoPlay = false) {
  if (!currentPdfDoc) return;

  currentPdfPage = pageNum;
  pdfPageNum.value = pageNum;
  btnPrevPage.disabled = (pageNum <= 1);
  btnNextPage.disabled = (pageNum >= totalPdfPages);

  playStatusText.textContent = `正在提取第 ${pageNum} 页文字...`;

  try {
    const page = await currentPdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // 合并段落文本
    let extractedText = "";
    let lastY = null;

    textContent.items.forEach(item => {
      // 简单根据 Y 坐标判断是否换行
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 8) {
        extractedText += "\n";
      }
      extractedText += item.str;
      lastY = item.transform[5];
    });

    extractedText = extractedText.trim();
    if (!extractedText) {
      extractedText = `【第 ${pageNum} 页为图片或无文字内容】`;
    }

    textInput.value = extractedText;
    updateTextStats();
    playStatusText.textContent = `已就绪 (第 ${pageNum} / ${totalPdfPages} 页)`;

    // 如果开启了连播，自动朗读本页
    if (autoPlay && extractedText && !extractedText.startsWith("【第")) {
      await startSpeechSynthesis();
    }
  } catch (err) {
    console.error("提取页面文字失败:", err);
  }
}

// 事件绑定
function setupEventListeners() {
  textInput.addEventListener("input", updateTextStats);

  // 预设示例点击
  document.querySelectorAll(".preset-chips .chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.sample;
      if (SAMPLE_TEXTS[type]) {
        textInput.value = SAMPLE_TEXTS[type];
        updateTextStats();
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
    updateRateDisplay(val);
  });

  pitchSlider.addEventListener("input", () => {
    const val = parseInt(pitchSlider.value, 10);
    updatePitchDisplay(val);
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

  // 核心：当前页播放结束后的自动翻页逻辑
  audioPlayer.addEventListener("ended", () => {
    playIcon.textContent = "▶";
    audioWave.classList.add("hidden");
    progressBar.style.width = "0%";
    currentTimeEl.textContent = "00:00";

    // 如果处于 PDF 电子书模式，且开启了“自动连续翻页朗读”
    if (currentPdfDoc && pdfAutoContinue.checked && currentPdfPage < totalPdfPages) {
      playStatusText.textContent = `第 ${currentPdfPage} 页读完，1.5 秒后自动翻到第 ${currentPdfPage + 1} 页...`;
      if (autoPageTimer) clearTimeout(autoPageTimer);
      autoPageTimer = setTimeout(() => {
        loadPdfPage(currentPdfPage + 1, true);
      }, 1500);
    } else {
      playStatusText.textContent = "朗读完毕";
    }
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
    const bookPrefix = currentPdfDoc ? `${currentPdfName}_第${currentPdfPage}页_` : "故事朗读_";
    a.download = `${bookPrefix}${new Date().toISOString().slice(0, 10)}.mp3`;
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

// 解锁浏览器音频播放权限
function unlockAudioContext() {
  if (!audioPlayer.src) {
    audioPlayer.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
  }
  const p = audioPlayer.play();
  if (p !== undefined) {
    p.then(() => {
      audioPlayer.pause();
    }).catch(() => {});
  }
}

async function handlePlayPause() {
  const text = textInput.value.trim();
  if (!text) {
    alert("请先输入或粘贴你想朗读的文字内容，或者上传 PDF 电子书！");
    return;
  }

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

  await startSpeechSynthesis();
}

// 核心语音合成与播放请求
async function startSpeechSynthesis() {
  const text = textInput.value.trim();
  if (!text) return;

  const rate = parseInt(rateSlider.value, 10);
  const pitch = parseInt(pitchSlider.value, 10);
  const synthesisKey = `${text}_${selectedVoice}_${rate}_${pitch}`;

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
