// ===== MJ Control Center - Electron Bridge =====
// Connects the static HTML UI to the IRIS Electron backend via IPC.

;(function () {
  'use strict'

  // --- Electron IPC Bridge ---
  // In Electron, window.electron is exposed via preload.
  // In a browser (dev preview), we fallback to demo mode.
  const ipc = window.electron && window.electron.ipcRenderer ? window.electron.ipcRenderer : null

  const isElectron = !!ipc

  // --- State ---
  let isPowerOn = false
  let isDarkMode = localStorage.getItem('theme') === 'dark'
  let isSidebarExpanded = false
  let statsInterval = null

  // Provider config state
  let providerConfig = null

  // --- Utility Functions ---
  // Note: showToast and Theme initialization are now in ui-utils.js

  // --- DOM refs ---
  const sidebar = document.getElementById('sidebar')
  const sidebarToggle = document.getElementById('sidebar-toggle')
  const powerBtn = document.getElementById('power-btn')
  const coreStatus = document.getElementById('core-status')
  const voiceStatus = document.getElementById('voice-status')
  const chatInput = document.getElementById('chat-input')
  const sendBtn = document.getElementById('send-btn')
  const chatMessages = document.getElementById('chat-messages')
  const attachBtn = document.getElementById('attach-btn')
  const fileInput = document.getElementById('file-input')
  const imagePreview = document.getElementById('image-preview')
  const previewImg = document.getElementById('preview-img')
  const removeImage = document.getElementById('remove-image')
  const appSearch = document.getElementById('app-search')

  // New tab elements
  const refreshGallery = document.getElementById('refresh-gallery')
  const newNoteBtn = document.getElementById('new-note-btn')
  const newWorkflowBtn = document.getElementById('new-workflow-btn')
  const scanFaceBtn = document.getElementById('scan-face-btn')
  const enrollFaceBtn = document.getElementById('enroll-face-btn')
  const testRecognitionBtn = document.getElementById('test-recognition-btn')
  const startResearchBtn = document.getElementById('start-research-btn')
  const researchQuery = document.getElementById('research-query')
  const addStockBtn = document.getElementById('add-stock-btn')
  const stockSymbol = document.getElementById('stock-symbol')
  const clearAlertsBtn = document.getElementById('clear-alerts-btn')
  const exportDataBtn = document.getElementById('export-data-btn')
  const clearHistoryBtn = document.getElementById('clear-history-btn')
  const resetSettingsBtn = document.getElementById('reset-settings-btn')
  const appSearchInput = document.getElementById('app-search-input')
  const refreshAppsBtn = document.getElementById('refresh-apps-btn')
  const connectPhoneBtn = document.getElementById('connect-phone-btn')
  const adbIp = document.getElementById('adb-ip')
  const adbPort = document.getElementById('adb-port')
  const phoneHomeBtn = document.getElementById('phone-home-btn')
  const phoneBackBtn = document.getElementById('phone-back-btn')
  const phoneRecentBtn = document.getElementById('phone-recent-btn')
  const phonePowerBtn = document.getElementById('phone-power-btn')
  const phoneScreenshotBtn = document.getElementById('phone-screenshot-btn')
  const addWidgetBtn = document.getElementById('add-widget-btn')
  const geminiKey = document.getElementById('gemini-key')
  const groqKey = document.getElementById('groq-key')
  const openaiKey = document.getElementById('openai-key')
  const anthropicKey = document.getElementById('anthropic-key')
  const deepseekKey = document.getElementById('deepseek-key')
  const mistralKey = document.getElementById('mistral-key')
  const openrouterKey = document.getElementById('openrouter-key')
  const xaiKey = document.getElementById('xai-key')
  const nvidiaKey = document.getElementById('nvidia-key')
  const hfKey = document.getElementById('hf-key')
  const tavilyKey = document.getElementById('tavily-key')
  const saveKeysBtn = document.getElementById('save-keys-btn')
  const voiceProfile = document.getElementById('voice-profile')
  const userName = document.getElementById('user-name')
  const personalityPrompt = document.getElementById('personality-prompt')
  const saveSettingsBtn = document.getElementById('save-settings-btn')

  // Monitor elements
  const cpuValue = document.getElementById('cpu-value')
  const cpuBar = document.getElementById('cpu-bar')
  const ramValue = document.getElementById('ram-value')
  const ramBar = document.getElementById('ram-bar')
  const ramUsed = document.getElementById('ram-used')
  const processCore = document.getElementById('process-core')
  const processBrain = document.getElementById('process-brain')
  const processVoice = document.getElementById('process-voice')
  const processSpinner = document.getElementById('process-spinner')

  // --- Tab Switching ---
  const sidebarItems = document.querySelectorAll('.sidebar-item')
  const tabContents = document.querySelectorAll('.tab-content')

  sidebarItems.forEach((item) => {
    item.addEventListener('click', () => {
      const tabId = item.dataset.tab
      sidebarItems.forEach((si) => si.classList.remove('active'))
      item.classList.add('active')
      tabContents.forEach((tc) => {
        tc.style.display = 'none'
        tc.classList.remove('active')
      })
      const target = document.getElementById('tab-' + tabId)
      if (target) {
        target.style.display = ''
        target.classList.add('active')
      }
      // Auto-load data when specific tabs are opened
      if (tabId === 'apps' && isElectron) {
        updateProcesses()
      }
      if (tabId === 'monitor' && isPowerOn) {
        updateStats()
      }
      if (tabId === 'settings' && isElectron) {
        loadSavedKeys()
      }
      if (tabId === 'subagents' && isElectron) {
        loadSubAgentProviders()
      }
      // Auto-load alerts when widgets tab opens (alerts is a sub-tab)
      if (tabId === 'widgets' && isElectron) {
        loadAlerts()
      }
    })
  })

  // --- Widgets & Tools Sub-Tab Switching ---
  const wtSubtabs = document.querySelectorAll('.wt-subtab')
  const wtSubpanels = document.querySelectorAll('.wt-subpanel')

  wtSubtabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.wtsub
      // Update active pill styling
      wtSubtabs.forEach((b) => {
        b.classList.remove('active-subtab')
        b.classList.remove('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/20')
        b.classList.add('bg-card', 'border', 'border-border', 'hover:border-primary/50')
      })
      btn.classList.add('active-subtab')
      btn.classList.remove('bg-card', 'border', 'border-border', 'hover:border-primary/50')
      btn.classList.add('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/20')
      // Show matching panel
      wtSubpanels.forEach((p) => {
        p.style.display = p.id === target ? 'block' : 'none'
      })
      // Auto-load data for specific sub-tabs
      if (target === 'wt-alerts' && isElectron) {
        loadAlerts()
      }
    })
  })

  // --- Sidebar Toggle ---
  sidebarToggle.addEventListener('click', () => {
    if (window.innerWidth >= 1100) {
      isSidebarExpanded = !isSidebarExpanded
      document.body.classList.toggle('sidebar-expanded', isSidebarExpanded)
    }
  })

  function handleResize() {
    if (window.innerWidth < 1100) {
      isSidebarExpanded = false
      document.body.classList.remove('sidebar-expanded')
    }
  }
  window.addEventListener('resize', handleResize)
  handleResize()

  // --- Power Button ---
  powerBtn.addEventListener('click', () => {
    isPowerOn = !isPowerOn

    if (isPowerOn) {
      powerBtn.className =
        'flex items-center gap-2 px-3 py-1.5 md:px-6 md:py-2.5 rounded-full font-bold text-[10px] md:text-sm transition-all active:scale-95 bg-rose-600 text-white shadow-lg shadow-rose-500/20'
      powerBtn.querySelector('span').textContent = 'STOP MJ'
      coreStatus.textContent = '● Core Active'
      coreStatus.className =
        'text-[8px] md:text-sm font-bold uppercase tracking-widest truncate text-emerald-500'
      voiceStatus.textContent = 'Voice: Standby'

      processCore.classList.add('process-active')
      processBrain.classList.add('process-active')
      processVoice.classList.add('process-active')
      if (processSpinner) processSpinner.classList.add('animate-spin')

      startStatsUpdates()
    } else {
      powerBtn.className =
        'flex items-center gap-2 px-3 py-1.5 md:px-6 md:py-2.5 rounded-full font-bold text-[10px] md:text-sm transition-all active:scale-95 bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
      powerBtn.querySelector('span').textContent = 'START MJ'
      coreStatus.textContent = '○ Core Offline'
      coreStatus.className =
        'text-[8px] md:text-sm font-bold uppercase tracking-widest truncate text-rose-500'
      voiceStatus.textContent = 'Voice: Standby'

      processCore.classList.remove('process-active')
      processBrain.classList.remove('process-active')
      processVoice.classList.remove('process-active')
      if (processSpinner) processSpinner.classList.remove('animate-spin')

      stopStatsUpdates()
      // Stop mic if running when power goes off
      if (isMicActive) {
        toggleMicrophone()
      }
    }
  })

  // --- Stats (real data from Electron, or simulated) ---
  function startStatsUpdates() {
    updateStats()
    updateProcesses()
    statsInterval = setInterval(updateStats, 3000)
    window.processInterval = setInterval(updateProcesses, 30000)
  }

  function stopStatsUpdates() {
    if (statsInterval) clearInterval(statsInterval)
    if (window.processInterval) clearInterval(window.processInterval)
    if (cpuValue) {
      cpuValue.textContent = '0%'
      cpuBar.style.width = '0%'
    }
    if (ramValue) {
      ramValue.textContent = '0%'
      ramBar.style.width = '0%'
    }
    if (ramUsed) ramUsed.textContent = '0GB'
    const diskValue = document.getElementById('disk-value')
    const diskBar = document.getElementById('disk-bar')
    const diskFree = document.getElementById('disk-free')
    const diskTotal = document.getElementById('disk-total')
    if (diskValue) diskValue.textContent = '0%'
    if (diskBar) diskBar.style.width = '0%'
    if (diskFree) diskFree.textContent = '0GB'
    if (diskTotal) diskTotal.textContent = '0GB'
  }

  async function updateStats() {
    if (isElectron) {
      try {
        const info = await ipc.invoke('get-system-stats')
        if (info) {
          if (info.cpu !== undefined) {
            const cpuStr = String(info.cpu)
            if (cpuValue) {
              cpuValue.textContent = cpuStr + '%'
              cpuBar.style.width = cpuStr + '%'
            }
          }
          if (info.memory !== undefined) {
            if (ramValue) {
              ramValue.textContent = info.memory.usedPercentage + '%'
              ramBar.style.width = info.memory.usedPercentage + '%'
            }
            if (ramUsed) ramUsed.textContent = info.memory.free + ' Free'
          }
        }

        // Get Drives
        const drives = await ipc.invoke('get-drives')
        if (drives && drives.length > 0) {
          const cDrive = Array.isArray(drives)
            ? drives.find((d) => d.Name === 'C') || drives[0]
            : drives
          if (cDrive && cDrive.FreeGB && cDrive.TotalGB) {
            const usedGB = cDrive.TotalGB - cDrive.FreeGB
            const diskPct = Math.round((usedGB / cDrive.TotalGB) * 100)
            const diskValue = document.getElementById('disk-value')
            const diskBar = document.getElementById('disk-bar')
            const diskFree = document.getElementById('disk-free')
            const diskTotal = document.getElementById('disk-total')
            if (diskValue) diskValue.textContent = diskPct + '%'
            if (diskBar) diskBar.style.width = diskPct + '%'
            if (diskFree) diskFree.textContent = cDrive.FreeGB + 'GB Free'
            if (diskTotal) diskTotal.textContent = cDrive.TotalGB + 'GB Total'
          }
        }
        return
      } catch (e) {
        console.error('Stats error:', e) /* fall through to simulated */
      }
    }
    // Simulated stats for demo / non-Electron mode
    const cpu = Math.floor(Math.random() * 30) + 5
    const ram = Math.floor(Math.random() * 20) + 40
    const ramGB = ((ram / 100) * 16).toFixed(1)
    if (cpuValue) {
      cpuValue.textContent = cpu + '%'
      cpuBar.style.width = cpu + '%'
    }
    if (ramValue) {
      ramValue.textContent = ram + '%'
      ramBar.style.width = ram + '%'
    }
    if (ramUsed) ramUsed.textContent = ramGB + 'GB'
  }

  // ========= CHAT → ELECTRON IPC BRIDGE =========
  if (chatInput) {
    chatInput.addEventListener('input', () => {
      sendBtn.disabled = !chatInput.value.trim() && !previewImg.src
    })
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    })
  }
  if (sendBtn) sendBtn.addEventListener('click', sendMessage)

  async function sendMessage() {
    const text = chatInput.value.trim()
    if (!text) return

    if (!isPowerOn) {
      appendMessage('error', 'MJ is currently OFF. Please start the core first.')
      chatInput.value = ''
      sendBtn.disabled = true
      return
    }

    appendMessage('user', text)
    chatInput.value = ''
    sendBtn.disabled = true

    // Show thinking indicator
    const thinkingEl = document.createElement('div')
    thinkingEl.className = 'flex items-center gap-2 text-rose-500 px-4 thinking-indicator'
    thinkingEl.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-bounce"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg><span class="text-xs font-medium animate-pulse">MJ is thinking...</span>'
    chatMessages.appendChild(thinkingEl)
    chatMessages.scrollTop = chatMessages.scrollHeight

    let replyText = 'No response.'

    const lowerText = text.toLowerCase()
    if (isElectron && lowerText.startsWith('play ') && lowerText.includes(' on spotify')) {
      const songName = lowerText.replace('play ', '').replace(' on spotify', '').trim()
      try {
        const result = await ipc.invoke('play-spotify-music', songName)
        thinkingEl.remove()
        appendMessage('mj', result)
        speakAndAnimate(result)
        saveChatHistory(text, result)
      } catch (err) {
        thinkingEl.remove()
        const errTxt = 'Backend error: ' + err.message
        appendMessage('error', errTxt)
      }
      return
    }

    function isChatError(message) {
      return typeof message === 'string' && /(^ERROR:|\bError:|\bFailed\b|\bfailed\b)/.test(message)
    }

    if (isElectron) {
      try {
        const result = await ipc.invoke('chat-with-ai', text)
        replyText = result || 'No response.'
        thinkingEl.remove()
        if (isChatError(replyText)) {
          appendMessage('error', replyText)
        } else {
          appendMessage('mj', replyText)
          speakAndAnimate(replyText)
        }
      } catch (err) {
        thinkingEl.remove()
        replyText = 'Backend error: ' + (err?.message || String(err))
        appendMessage('error', replyText)
      }
    } else {
      await new Promise((r) => setTimeout(r, 1500))
      thinkingEl.remove()
      replyText =
        'I received: "' + text + '". Connect to Electron backend for full AI functionality.'
      appendMessage('mj', replyText)
      speakAndAnimate(replyText)
    }

    saveChatHistory(text, replyText)
  }

  function saveChatHistory(userText, aiReply) {
    let history = []
    try {
      history = JSON.parse(localStorage.getItem('mj_chat_history') || '[]')
    } catch (e) {}
    history.push({ user: userText, ai: aiReply, time: new Date().toISOString() })
    if (history.length > 50) history.shift() // Keep last 50
    localStorage.setItem('mj_chat_history', JSON.stringify(history))
    renderChatHistory()
  }

  function renderChatHistory() {
    const list = document.getElementById('chat-history-list')
    if (!list) return
    let history = []
    try {
      history = JSON.parse(localStorage.getItem('mj_chat_history') || '[]')
    } catch (e) {}

    if (history.length === 0) {
      list.innerHTML =
        '<button class="text-left text-xs p-2 rounded-lg hover:bg-accent truncate w-full text-muted-foreground opacity-50">No history available</button>'
      return
    }

    list.innerHTML = history
      .slice()
      .reverse()
      .map(
        (h) => `
      <button class="text-left text-xs p-2 rounded-lg hover:bg-accent truncate w-full text-muted-foreground transition-colors group relative" title="${escapeHtml(h.user)}">
        <span class="font-semibold text-foreground block truncate">${escapeHtml(h.user)}</span>
        <span class="opacity-50 text-[10px] truncate block">${escapeHtml(h.ai).substring(0, 40)}...</span>
      </button>
    `
      )
      .join('')
  }

  const clearChatHistoryBtn = document.getElementById('clear-chat-history')
  if (clearChatHistoryBtn) {
    clearChatHistoryBtn.addEventListener('click', () => {
      if (confirm('Clear all chat history?')) {
        localStorage.removeItem('mj_chat_history')
        renderChatHistory()
      }
    })
  }

  // Initial load
  renderChatHistory()

  let currentVisualizerType = 'pulse'

  // --- Audio Engine for Visualizer ---
  let audioCtx = null;
  let analyser = null;
  let microphone = null;
  let dataArray = null;
  let isMicActive = false;
  let visualizerRafId = null;
  const micBtn = document.getElementById('mic-btn');
  let speechRecognition = null;

  async function initAudioEngine() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      if (!microphone) {
         try {
           const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
           microphone = audioCtx.createMediaStreamSource(stream);
           microphone.connect(analyser);
         } catch(e) {}
      }
      return;
    }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphone = audioCtx.createMediaStreamSource(stream);
      microphone.connect(analyser);
      startVisualizerLoop();
    } catch (err) {
      console.warn('Audio engine init failed (Mic access denied?):', err);
      startVisualizerLoop(); // Still start loop for TTS fallback
    }
  }

  function toggleMicrophone() {
    if (!isPowerOn) {
      if (typeof showToast !== 'undefined') showToast('Please start MJ first.', 'warning');
      return;
    }

    if (!isMicActive) {
      // Turn ON
      isMicActive = true;
      initAudioEngine();
      if (micBtn) {
        micBtn.classList.remove('bg-card', 'text-muted-foreground', 'bg-emerald-500', 'hover:bg-accent');
        micBtn.classList.add('bg-rose-500', 'text-white', 'shadow-lg', 'shadow-rose-500/20');
        const offIcon = document.getElementById('mic-icon-off');
        const onIcon = document.getElementById('mic-icon-on');
        const pulse = document.getElementById('mic-pulse');
        if (offIcon) offIcon.style.display = 'none';
        if (onIcon) onIcon.style.display = 'block';
        if (pulse) pulse.style.display = 'block';
      }
      
      if (chatInput) {
        chatInput.disabled = true;
        chatInput.placeholder = 'Listening for voice...';
        chatInput.classList.add('opacity-50');
      }

      if (!speechRecognition) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          speechRecognition = new SpeechRecognition();
          speechRecognition.continuous = true;
          speechRecognition.interimResults = true;
          // default language or user's OS locale is used
          speechRecognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              }
            }
            if (finalTranscript.trim() !== '') {
              if (chatInput) chatInput.value = finalTranscript;
              if (sendBtn && !sendBtn.disabled) {
                sendBtn.click();
              } else if (sendBtn && sendBtn.disabled) {
                 sendBtn.disabled = false;
                 sendBtn.click();
              }
            }
          };
          speechRecognition.onend = () => {
             if (isMicActive) speechRecognition.start();
          };
        }
      }
      
      if (speechRecognition) {
        try { speechRecognition.start(); } catch(e){}
      }
    } else {
      // Turn OFF
      isMicActive = false;
      if (microphone) {
        microphone.disconnect();
        microphone = null;
      }
      
      if (micBtn) {
        micBtn.classList.remove('bg-rose-500', 'text-white', 'shadow-lg', 'shadow-rose-500/20');
        micBtn.classList.add('bg-emerald-500', 'text-white');
        const offIcon = document.getElementById('mic-icon-off');
        const onIcon = document.getElementById('mic-icon-on');
        const pulse = document.getElementById('mic-pulse');
        if (offIcon) offIcon.style.display = 'block';
        if (onIcon) onIcon.style.display = 'none';
        if (pulse) pulse.style.display = 'none';
      }
      
      if (chatInput) {
        chatInput.disabled = false;
        chatInput.placeholder = 'Type a message... (Ctrl+Enter to send)';
        chatInput.classList.remove('opacity-50');
        chatInput.focus();
      }

      if (speechRecognition) {
        speechRecognition.stop();
      }
    }
  }

  if (micBtn) {
    micBtn.addEventListener('click', toggleMicrophone);
  }


  function startVisualizerLoop() {
    if (visualizerRafId) cancelAnimationFrame(visualizerRafId);
    
    function loop() {
      visualizerRafId = requestAnimationFrame(loop);
      const vizPreview = document.getElementById('viz-preview');
      const root = vizPreview?.firstElementChild;
      
      if (!root || !isPowerOn) {
        if (root) resetVisualizerStyles(root);
        return;
      }

      let avgFreq = 0;
      if (isMicActive && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        avgFreq = sum / dataArray.length;
      }
      
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        avgFreq = Math.max(avgFreq, 40 + Math.random() * 80);
      }

      animateVisualizerWithAudio(root, avgFreq);
    }
    loop();
  }

  function setVisualizerTemplate(type) {
    const vizPreview = document.getElementById('viz-preview')
    if (!vizPreview || !vizTemplates[type]) return

    currentVisualizerType = type
    vizPreview.innerHTML = vizTemplates[type]
  }

  function resetVisualizerStyles(root) {
    if (!root) return
    root.querySelectorAll('[style]').forEach((node) => node.removeAttribute('style'))
  }

  function animateVisualizerWithAudio(root, avgFreq) {
    if (!root) return

    // avgFreq is between 0 and 255. Normalize to 0-1 for scaling.
    const volume = avgFreq / 255;

    switch (currentVisualizerType) {
      case 'pulse': {
        const vizNode = root.querySelector('.absolute')
        const innerNode = root.querySelector('.w-6')
        if (vizNode && innerNode) {
          const scaleOut = 0.95 + (volume * 0.5);
          const scaleIn = 0.9 + (volume * 0.3);
          vizNode.style.transform = `scale(${scaleOut})`
          innerNode.style.transform = `scale(${scaleIn})`
          vizNode.style.transition = 'transform 0.05s linear'
          innerNode.style.transition = 'transform 0.05s linear'
        }
        break
      }
      case 'wave':
      case 'bars': {
        const bars = root.querySelectorAll('.bar');
        bars.forEach((bar, index) => {
          if (bar instanceof HTMLElement) {
            const height = 10 + (volume * (60 + index * 10)) + (Math.random() * 5 * volume);
            bar.style.height = `${height}px`
            bar.style.transition = 'height 0.05s linear'
          }
        })
        break
      }
      case 'liquid': {
        if (root instanceof HTMLElement) {
          root.style.transform = `translateY(${Math.sin(Date.now() / 150) * (5 + volume * 10)}px)`
          root.style.boxShadow = `0 0 ${6 + volume * 20}px rgba(56, 189, 248, ${0.3 + volume * 0.5})`
        }
        break
      }
      case 'aura': {
        const glow = root.querySelector('.glow')
        const dot = root.querySelector('.dot')
        if (glow instanceof HTMLElement) {
          glow.style.boxShadow = `0 0 ${10 + volume * 30}px rgba(59, 130, 246, ${0.4 + volume * 0.5})`
        }
        if (dot instanceof HTMLElement) {
          dot.style.transform = `scale(${0.8 + volume * 0.4})`
        }
        break
      }
      case 'orbit': {
        root.querySelectorAll('.ring').forEach((ring, index) => {
          if (ring instanceof HTMLElement) {
            ring.style.transform = `rotate(${Date.now() / (30 - volume * 15) + index * 45}deg)`
          }
        })
        break
      }
      case 'vortex': {
        root.querySelectorAll('.ring').forEach((ring, index) => {
          if (ring instanceof HTMLElement) {
            ring.style.transform = `scale(${1 + volume * 0.2 + Math.sin(Date.now() / 150 + index) * 0.05})`
          }
        })
        break
      }
      case 'cyber': {
        const path = root.querySelector('.line')
        if (path instanceof HTMLElement) {
          path.style.strokeDashoffset = `${volume * 40}`
        }
        break
      }
      default:
        break
    }
  }

  function speakAndAnimate(text) {
    if (!window.speechSynthesis) return

    // Clean text from markdown for speech
    const cleanText = text.replace(/[*_#]/g, '').replace(/```[\s\S]*?```/g, 'Code block omitted.')

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = 1.0
    utterance.pitch = 1.0

    // Attempt to pick a good voice
    const voices = window.speechSynthesis.getVoices()
    const mjVoice =
      voices.find(
        (v) =>
          v.name.includes('Female') ||
          v.name.includes('Zira') ||
          v.name.includes('Google UK English Female')
      ) || voices[0]
    if (mjVoice) utterance.voice = mjVoice

    window.speechSynthesis.cancel() // Stop current speech
    window.speechSynthesis.speak(utterance)
  }

  function appendMessage(role, text) {
    const wrapper = document.createElement('div')
    wrapper.className = 'flex flex-col gap-2 ' + (role === 'user' ? 'items-end' : 'items-start')

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    let headerHTML = ''
    let bubbleClass = ''

    if (role === 'user') {
      headerHTML =
        '<span class="text-[10px] opacity-50">' +
        time +
        '</span><span class="text-xs font-bold text-blue-400">You</span>'
      bubbleClass = 'bg-blue-600 text-white rounded-tr-none shadow-blue-500/10'
    } else if (role === 'mj') {
      headerHTML =
        '<span class="text-xs font-bold text-rose-500">MJ</span><span class="text-[10px] opacity-50">' +
        time +
        '</span>'
      bubbleClass = 'bg-card text-foreground border border-border rounded-tl-none'
    } else if (role === 'error') {
      bubbleClass = 'bg-rose-500/10 text-rose-600 border border-rose-500/20 w-full text-center'
    } else {
      bubbleClass =
        'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 w-full text-center italic'
    }

    const parsedContent =
      typeof marked !== 'undefined' ? marked.parse(text) : '<p>' + escapeHtml(text) + '</p>'

    wrapper.innerHTML =
      '<div class="flex items-center gap-2 px-2">' +
      headerHTML +
      '</div>' +
      '<div class="relative group max-w-[90%] md:max-w-[85%] rounded-2xl p-3 md:p-4 text-xs md:text-sm leading-relaxed shadow-sm ' +
      bubbleClass +
      '" style="user-select: text; -webkit-user-select: text;">' +
      '<div class="prose prose-sm max-w-none">' +
      parsedContent +
      '</div>' +
      '<button class="copy-btn absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" title="Copy Message">' +
      '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>' +
      '</button>' +
      '</div>'

    const copyBtn = wrapper.querySelector('.copy-btn')
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.innerHTML = '<svg class="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
          setTimeout(() => {
            copyBtn.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>'
          }, 2000)
        }).catch(err => console.error('Copy failed:', err))
      })
    }

    chatMessages.appendChild(wrapper)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }

  function escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  // --- Image Upload ---
  if (attachBtn) attachBtn.addEventListener('click', () => fileInput.click())
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0]
      if (file) handleImageFile(file)
    })
  }

  if (chatInput) {
    chatInput.addEventListener('dragover', (e) => {
      e.preventDefault()
      chatInput.classList.add('border-primary', 'bg-primary/5')
    })
    chatInput.addEventListener('dragleave', (e) => {
      e.preventDefault()
      chatInput.classList.remove('border-primary', 'bg-primary/5')
    })
    chatInput.addEventListener('drop', (e) => {
      e.preventDefault()
      chatInput.classList.remove('border-primary', 'bg-primary/5')
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleImageFile(e.dataTransfer.files[0])
      }
    })
  }

  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      previewImg.src = reader.result
      imagePreview.style.display = 'flex'
      sendBtn.disabled = false
    }
    reader.readAsDataURL(file)
  }

  if (removeImage) {
    removeImage.addEventListener('click', () => {
      previewImg.src = ''
      imagePreview.style.display = 'none'
      fileInput.value = ''
      sendBtn.disabled = !chatInput.value.trim()
    })
  }

  // --- App Search ---
  if (appSearch) {
    appSearch.addEventListener('input', () => {
      const term = appSearch.value.toLowerCase()
      document.querySelectorAll('.app-item').forEach((item) => {
        const name = item.dataset.name.toLowerCase()
        item.style.display = name.includes(term) ? '' : 'none'
      })
    })
  }

  // --- App Permission Toggle ---
  document.querySelectorAll('.app-perm-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const isAllowed = btn.dataset.allowed === 'true'
      btn.dataset.allowed = isAllowed ? 'false' : 'true'
      if (isAllowed) {
        btn.textContent = 'Denied'
        btn.className =
          'app-perm-btn px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-widest transition-all bg-rose-500/10 text-rose-500'
      } else {
        btn.textContent = 'Allowed'
        btn.className =
          'app-perm-btn px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-widest transition-all bg-emerald-500/10 text-emerald-500'
      }
    })
  })

  // --- Privacy Toggle Buttons ---
  document.querySelectorAll('.toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const isActive = btn.dataset.active === 'true'
      btn.dataset.active = isActive ? 'false' : 'true'
      const knob = btn.querySelector('div')
      if (isActive) {
        btn.classList.remove('bg-emerald-500')
        btn.classList.add('bg-slate-300')
        knob.classList.remove('translate-x-6')
        knob.classList.add('translate-x-0')
      } else {
        btn.classList.remove('bg-slate-300')
        btn.classList.add('bg-emerald-500')
        knob.classList.remove('translate-x-0')
        knob.classList.add('translate-x-6')
      }
      // Save privacy permission states to backend
      if (isElectron) {
        const permStates = {}
        document.querySelectorAll('.toggle-btn').forEach((t) => {
          const label = t.closest('.flex')?.querySelector('span')?.textContent?.trim() || ''
          permStates[label.toLowerCase().replace(/\s+/g, '_')] = t.dataset.active === 'true'
        })
        ipc.invoke('settings-save', { permissions: permStates }).catch(() => {})
      }
    })
  })

  // --- Visualizer Selection ---
  const vizBtns = document.querySelectorAll('.viz-btn')
  const vizPreview = document.getElementById('viz-preview')

  const vizTemplates = {
    pulse:
      '<div class="viz-pulse relative w-12 h-12 flex items-center justify-center"><div class="absolute w-full h-full bg-primary rounded-full animate-pulse-scale"></div><div class="w-6 h-6 bg-primary rounded-full shadow-lg shadow-primary/50"></div></div>',
    wave: '<div class="viz-wave"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>',
    bars: '<div class="viz-bars"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>',
    liquid: '<div class="viz-liquid"></div>',
    aura: '<div class="viz-aura"><div class="glow"></div><div class="dot"></div></div>',
    orbit:
      '<div class="viz-orbit"><div class="center"></div><div class="ring"><div class="sat"></div></div><div class="ring"><div class="sat"></div></div><div class="ring"><div class="sat"></div></div></div>',
    vortex:
      '<div class="viz-vortex"><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="ring"></div></div>',
    cyber:
      '<div class="viz-cyber"><svg viewBox="0 0 100 40"><path class="line" d="M0,20 L20,20 L25,10 L35,30 L40,20 L60,20 L65,5 L75,35 L80,20 L100,20"/><path class="glow-line" d="M0,20 L20,20 L25,10 L35,30 L40,20 L60,20 L65,5 L75,35 L80,20 L100,20"/></svg></div>'
  }

  vizBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      vizBtns.forEach((b) => {
        b.classList.remove(
          'active-viz',
          'bg-primary',
          'text-primary-foreground',
          'border-primary',
          'shadow-lg',
          'shadow-primary/20'
        )
        b.classList.add('bg-card', 'border-border')
      })
      btn.classList.add('active-viz')
      btn.classList.remove('bg-card', 'border-border')

      const type = btn.dataset.viz
      setVisualizerTemplate(type)
    })
  })

  // Initialize the visualizer preview with the default type
  setVisualizerTemplate(currentVisualizerType)
  // --- Sub Agent Input (routed through chat-with-ai) ---
  const addAgentBtn = document.getElementById('add-agent-btn')
  const agentSelectEl = document.getElementById('agent-select')
  const subagentInput = document.getElementById('subagent-input')
  const subagentSend = document.getElementById('subagent-send')
  const subagentMessages = document.getElementById('subagent-messages')

  // Load available providers for Sub Agents
  async function loadSubAgentProviders() {
    if (!isElectron || !agentSelectEl) return

    try {
      const providerConfig = await ipc.invoke('provider-load-config')
      if (!providerConfig) return

      // Clear existing options
      agentSelectEl.innerHTML = ''

      // Add available providers that have API keys
      const availableProviders = [
        { key: 'gemini', name: 'Google Gemini', icon: '🤖' },
        { key: 'groq', name: 'Groq', icon: '⚡' },
        { key: 'openai', name: 'OpenAI', icon: '🟢' },
        { key: 'anthropic', name: 'Anthropic', icon: '🟣' },
        { key: 'deepseek', name: 'DeepSeek', icon: '🌊' },
        { key: 'mistral', name: 'Mistral', icon: '🌪️' },
        { key: 'openrouter', name: 'OpenRouter', icon: '🔀' },
        { key: 'xai', name: 'xAI (Grok)', icon: '🚀' },
        { key: 'nvidia_nim', name: 'Nvidia NIM', icon: '🟢' },
        { key: 'huggingface', name: 'Hugging Face', icon: '🤗' },
        { key: 'tavily', name: 'Tavily Search', icon: '🔍' }
      ]

      availableProviders.forEach((provider) => {
        if (providerConfig[provider.key]?.apiKey) {
          const opt = document.createElement('option')
          opt.value = provider.key
          opt.textContent = `${provider.icon} ${provider.name}`
          agentSelectEl.appendChild(opt)
        }
      })

      // Update placeholder if we have providers
      if (agentSelectEl.options.length > 0) {
        updateSubAgentPlaceholder()
      }
    } catch (error) {
      console.error('Failed to load sub agent providers:', error)
    }
  }

  function updateSubAgentPlaceholder() {
    if (!agentSelectEl || !subagentInput) return
    const selectedOption = agentSelectEl.options[agentSelectEl.selectedIndex]
    if (selectedOption) {
      const providerName = selectedOption.textContent.split(' ').slice(1).join(' ') // Remove icon
      subagentInput.placeholder = `Message ${providerName}...`
    }
  }

  if (addAgentBtn) {
    addAgentBtn.addEventListener('click', () => {
      const name = prompt('Enter custom agent name (e.g., "My GPT-4"):')
      if (!name || !name.trim()) return
      if (agentSelectEl) {
        const opt = document.createElement('option')
        opt.value = 'custom-' + Date.now()
        opt.textContent = name.trim()
        agentSelectEl.appendChild(opt)
        agentSelectEl.value = opt.value
        updateSubAgentPlaceholder()
      }
    })
  }

  if (agentSelectEl) {
    agentSelectEl.addEventListener('change', updateSubAgentPlaceholder)
  }

  async function sendSubAgentMessage() {
    const text = subagentInput ? subagentInput.value.trim() : ''
    if (!text) return

    const selectedProvider = agentSelectEl ? agentSelectEl.value : 'auto'
    const selectedAgentName = agentSelectEl
      ? agentSelectEl.options[agentSelectEl.selectedIndex]?.text || 'AI'
      : 'AI'

    // Show user message
    if (subagentMessages) {
      // Clear placeholder if present
      if (subagentMessages.querySelector('.text-muted-foreground')) {
        subagentMessages.innerHTML = ''
      }
      subagentMessages.innerHTML += `<div class="flex justify-end"><div class="max-w-[75%] p-3 rounded-2xl bg-primary text-primary-foreground text-sm">${escapeHtml(text)}</div></div>`
    }
    subagentInput.value = ''
    subagentSend.disabled = true

    if (isElectron) {
      try {
        // Route to specific provider
        const reply = await ipc.invoke('chat-with-ai', {
          text: text,
          provider: selectedProvider
        })

        const isError =
          typeof reply === 'string' && /(^ERROR:|\bError:|\bFailed\b|\bfailed\b)/.test(reply)
        const content = escapeHtml(reply || 'No response')
        if (subagentMessages) {
          subagentMessages.innerHTML += `<div class="flex justify-start"><div class="max-w-[75%] p-3 rounded-2xl ${isError ? 'bg-rose-500/10 border border-rose-500/20 text-rose-600' : 'bg-card border border-border'} text-sm"><span class="text-[10px] font-bold ${isError ? 'text-rose-600' : 'text-primary'} uppercase block mb-1">${escapeHtml(isError ? 'Error' : selectedAgentName)}</span>${content}</div></div>`
          subagentMessages.scrollTop = subagentMessages.scrollHeight
        }
      } catch (err) {
        console.error('Sub agent chat failed:', err)
        if (subagentMessages) {
          subagentMessages.innerHTML += `<div class="flex justify-start"><div class="max-w-[75%] p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-sm text-red-600"><span class="text-[10px] font-bold uppercase block mb-1">Error</span>Failed to communicate with ${selectedAgentName}</div></div>`
          subagentMessages.scrollTop = subagentMessages.scrollHeight
        }
      } finally {
        subagentSend.disabled = false
      }
    } else {
      if (subagentMessages) {
        subagentMessages.innerHTML += `<div class="flex justify-start"><div class="max-w-[75%] p-3 rounded-2xl bg-card border border-border text-sm">Sub Agent chat requires Electron backend. Running in demo mode.</div></div>`
      }
      subagentSend.disabled = false
    }
  }

  if (subagentInput) {
    subagentInput.addEventListener('input', () => {
      subagentSend.disabled = !subagentInput.value.trim()
    })
    subagentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendSubAgentMessage()
      }
    })
  }
  if (subagentSend) {
    subagentSend.addEventListener('click', sendSubAgentMessage)
  }

  // --- Scan System Button (REAL data from Electron) ---
  const scanBtn = document.getElementById('scan-btn')
  if (scanBtn) {
    scanBtn.addEventListener('click', async () => {
      scanBtn.disabled = true
      scanBtn.classList.add('animate-pulse')
      scanBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg> Scanning...'

      await updateProcesses()

      scanBtn.disabled = false
      scanBtn.classList.remove('animate-pulse')
      scanBtn.innerHTML = 'Scan System'
    })
  }

  // --- Dynamic Processes ---
  async function updateProcesses() {
    if (!isElectron) return
    try {
      const apps = await ipc.invoke('get-installed-apps')
      const appsGrid = document.getElementById('apps-grid')
      if (apps && apps.length > 0 && appsGrid) {
        // Helper to generate a consistent color based on string
        const stringToColor = (str) => {
          let hash = 0
          for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
          const hue = Math.abs(hash) % 360
          return `hsl(${hue}, 70%, 60%)`
        }

        // Populate bottom grid with all apps
        appsGrid.innerHTML = apps
          .map((a) => {
            const letter = (a.name || 'A').charAt(0).toUpperCase()
            const color = stringToColor(a.name)
            const isAllowed = Math.random() > 0.3 // Default randomly for demo, or all true
            return `
                    <div class="app-item p-3 md:p-4 rounded-xl md:rounded-2xl bg-card border border-border flex items-center justify-between hover:border-primary/30 transition-colors group" data-name="${escapeHtml(a.name)}">
                        <div class="flex items-center gap-2 md:gap-3 min-w-0">
                            <div class="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm font-bold text-lg md:text-xl" style="background-color: ${color}">
                                ${letter}
                            </div>
                            <span class="font-bold text-xs md:text-sm truncate">${escapeHtml(a.name)}</span>
                        </div>
                        <button onclick="this.dataset.allowed = this.dataset.allowed === 'true' ? 'false' : 'true'; this.textContent = this.dataset.allowed === 'true' ? 'Allowed' : 'Denied'; this.className = 'app-perm-btn px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-widest transition-all ' + (this.dataset.allowed === 'true' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500')" 
                                class="app-perm-btn px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-widest transition-all ${isAllowed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}" 
                                data-allowed="${isAllowed}">
                            ${isAllowed ? 'Allowed' : 'Denied'}
                        </button>
                    </div>
                `
          })
          .join('')

        // Populate active feed in Monitor
        const processCore = document.getElementById('process-core')
        if (processCore && processCore.parentElement) {
          processCore.parentElement.innerHTML = `
                        <div class="grid grid-cols-4 text-[8px] md:text-[10px] uppercase tracking-widest font-bold opacity-30 px-2 mb-4">
                            <span>Process</span><span>PID</span><span>Status</span><span>AppID</span>
                        </div>
                        ${apps
                          .slice(0, 4)
                          .map(
                            (a) => `
                        <div class="grid grid-cols-4 py-1.5 md:py-2 px-2 rounded-lg transition-colors text-[10px] md:text-sm hover:bg-accent align-middle items-center">
                            <span class="font-bold truncate text-xs">${escapeHtml(a.name)}</span>
                            <span class="opacity-50 text-[10px]">Local</span>
                            <span class="text-emerald-500 font-bold text-[10px]">Active</span>
                            <span class="truncate opacity-50 text-[9px]">${escapeHtml(a.id)}</span>
                        </div>
                        `
                          )
                          .join('')}
                    `
        }
      }
    } catch (err) {
      console.error('Failed to get apps:', err)
    }
  }

  // --- Log Electron status ---
  console.log('[MJ Control Center] Electron bridge:', isElectron ? 'CONNECTED' : 'DEMO MODE')

  // ========= QUARANTINE ZONE =========
  const refreshQuarantineBtn = document.getElementById('refresh-quarantine')
  const quarantineListEl = document.getElementById('quarantine-list')

  async function loadQuarantine() {
    if (!isElectron || !quarantineListEl) return

    quarantineListEl.innerHTML =
      '<div class="p-6 text-center opacity-50"><p class="text-sm font-medium animate-pulse">Scanning Windows Defender Quarantine...</p></div>'

    try {
      const items = await ipc.invoke('get-defender-quarantine')
      if (!items || items.length === 0) {
        quarantineListEl.innerHTML =
          '<div class="p-6 text-center border-2 border-dashed border-border rounded-2xl opacity-50"><p class="text-sm font-medium">🛡️ No threats detected by Windows Defender.</p><p class="text-xs opacity-50 mt-1">System is clean.</p></div>'
        return
      }
      quarantineListEl.innerHTML = items
        .map(
          (item) => `
                <div class="flex items-center justify-between p-4 rounded-xl bg-background border border-amber-500/20 hover:border-amber-500/40 transition-colors">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold truncate text-rose-500">${escapeHtml(item.ThreatName || 'Unknown Threat')}</p>
                        <p class="text-[10px] opacity-50 truncate">${escapeHtml((item.Resources || []).join(', ') || 'No resources available')}</p>
                        <p class="text-[10px] opacity-30">${item.InitialDetectionTime ? new Date(parseInt(item.InitialDetectionTime.replace(/[^0-9]/g, ''), 10)).toLocaleString() : 'Unknown Date'}</p>
                    </div>
                    <div class="flex gap-2 ml-3 shrink-0 flex-col sm:flex-row">
                        <button onclick="restoreQuarantined('${escapeHtml(item.ThreatName)}')" class="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-bold hover:bg-emerald-500 hover:text-white transition-all">Restore</button>
                        <button onclick="deleteQuarantined('${escapeHtml(item.ThreatName)}')" class="px-3 py-1 bg-rose-500/10 text-rose-500 rounded-lg text-[10px] font-bold hover:bg-rose-500 hover:text-white transition-all">Remove</button>
                    </div>
                </div>
            `
        )
        .join('')
    } catch (e) {
      console.error('[Quarantine]', e)
    }
  }

  window.restoreQuarantined = async function (id) {
    if (!isElectron) return
    const btn = event.target
    btn.textContent = 'Wait...'
    await ipc.invoke('restore-defender-quarantine', id)
    loadQuarantine()
  }

  window.deleteQuarantined = async function (id) {
    if (!isElectron) return
    const btn = event.target
    btn.textContent = 'Wait...'
    await ipc.invoke('remove-defender-quarantine', id)
    loadQuarantine()
  }

  async function loadSecurityStatus() {
    if (!isElectron) return
    try {
      const status = await ipc.invoke('get-security-status')
      if (status) {
        const fw = document.getElementById('sec-firewall')
        if (fw) {
          fw.textContent = status.firewall
          fw.className = `text-sm font-bold ${status.firewall === 'ACTIVE' ? 'text-emerald-500' : 'text-rose-500'}`
        }

        const av = document.getElementById('sec-antivirus')
        if (av) {
          av.textContent = status.antivirus
          av.className = `text-sm font-bold ${status.antivirus === 'ACTIVE' ? 'text-emerald-500' : 'text-rose-500'}`
        }

        const ls = document.getElementById('sec-lastscan')
        if (ls) {
          ls.textContent = status.lastScan <= 1 ? 'Today' : `${status.lastScan} days ago`
        }

        const thr = document.getElementById('sec-threats')
        if (thr) {
          const items = await ipc.invoke('get-defender-quarantine')
          const count = items && items.length ? items.length : 0
          thr.textContent = count === 0 ? 'None' : count
          thr.className = `text-sm font-bold ${count === 0 ? 'text-emerald-500' : 'text-rose-500'}`
        }
      } else {
        const elements = ['sec-firewall', 'sec-antivirus']
        elements.forEach((id) => {
          const el = document.getElementById(id)
          if (el) {
            el.textContent = 'OFFLINE'
            el.className = 'text-sm font-bold text-rose-500'
          }
        })
        const ls = document.getElementById('sec-lastscan')
        if (ls) ls.textContent = 'Unknown'
        const thr = document.getElementById('sec-threats')
        if (thr) {
          thr.textContent = 'Unknown'
          thr.className = 'text-sm font-bold text-rose-500'
        }
      }
    } catch (e) {
      console.error('Failed to load security status:', e)
    }
  }

  if (refreshQuarantineBtn)
    refreshQuarantineBtn.addEventListener('click', () => {
      loadQuarantine()
      loadSecurityStatus()
    })
  // Auto-load on settings/privacy tab open
  document.querySelector('[data-tab="settings"]')?.addEventListener('click', () => {
    setTimeout(() => {
      loadQuarantine()
      loadSecurityStatus()
    }, 200)
  })

  const runFullScanBtn = document.getElementById('run-full-scan-btn')
  if (runFullScanBtn) {
    runFullScanBtn.addEventListener('click', async () => {
      runFullScanBtn.disabled = true
      runFullScanBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin inline mr-2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg> SCANNING...'
      const success = await ipc.invoke('run-full-scan')
      if (success) {
        runFullScanBtn.innerHTML = 'SCAN STARTED!'
      } else {
        runFullScanBtn.innerHTML = 'SCAN FAILED'
      }
      setTimeout(() => {
        runFullScanBtn.innerHTML = 'RUN FULL SYSTEM SCAN'
        runFullScanBtn.disabled = false
      }, 5000)
    })
  }

  // ========= SAVE AGENT API KEYS (includes Telegram/Email) =========
  async function saveAllAgentConfigs() {
    const config = {
      brain: {
        provider: document.getElementById('brain-provider')?.value || 'google',
        key: document.getElementById('brain-api-key')?.value || ''
      },
      vision: {
        provider: document.getElementById('vision-provider')?.value || 'google',
        key: document.getElementById('vision-api-key')?.value || ''
      },
      code: {
        provider: document.getElementById('code-provider')?.value || 'anthropic',
        key: document.getElementById('code-api-key')?.value || ''
      },
      tavily: document.getElementById('tavily-api-key')?.value || '',
      image: document.getElementById('image-api-key')?.value || '',
      telegram: {
        token: document.getElementById('telegram-token')?.value || '',
        chatId: document.getElementById('telegram-chat-id')?.value || ''
      },
      email: {
        address: document.getElementById('email-address')?.value || '',
        password: document.getElementById('email-password')?.value || ''
      }
    }

    if (isElectron) {
      try {
        await ipc.invoke('secure-save-keys', {
          groqKey: JSON.stringify(config),
          geminiKey: config.brain.key
        })
        showToast('API keys saved successfully', 'success')
      } catch (e) {
        showToast('Failed to save API keys', 'error')
      }
    } else {
      showToast('API key encryption requires the Electron app.', 'error')
    }
  }

  document.querySelectorAll('.agent-edit-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-target')
      const inputEl = document.getElementById(targetId)
      if (!inputEl) return

      if (inputEl.hasAttribute('readonly')) {
        // Switch to edit mode
        inputEl.removeAttribute('readonly')
        inputEl.focus()
        btn.textContent = 'Save'
        btn.classList.add('bg-emerald-500/20', 'text-emerald-500')
      } else {
        // Save mode
        inputEl.setAttribute('readonly', 'true')
        btn.textContent = 'Edit'
        btn.classList.remove('bg-emerald-500/20', 'text-emerald-500')
        await saveAllAgentConfigs()
      }
    })
  })

  // ========= LOAD SAVED KEYS (populate Settings fields) =========
  async function loadSavedKeys() {
    if (!isElectron) return
    try {
      providerConfig = await ipc.invoke('provider-load-config')
      if (providerConfig) {
        // Populate API key fields
        if (geminiKey && providerConfig.gemini?.apiKey) {
          geminiKey.value = providerConfig.gemini.apiKey
        }
        if (groqKey && providerConfig.groq?.apiKey) {
          groqKey.value = providerConfig.groq.apiKey
        }
        if (openaiKey && providerConfig.openai?.apiKey) {
          openaiKey.value = providerConfig.openai.apiKey
        }
        if (anthropicKey && providerConfig.anthropic?.apiKey) {
          anthropicKey.value = providerConfig.anthropic.apiKey
        }
        if (deepseekKey && providerConfig.deepseek?.apiKey) {
          deepseekKey.value = providerConfig.deepseek.apiKey
        }
        if (mistralKey && providerConfig.mistral?.apiKey) {
          mistralKey.value = providerConfig.mistral.apiKey
        }
        if (openrouterKey && providerConfig.openrouter?.apiKey) {
          openrouterKey.value = providerConfig.openrouter.apiKey
        }
        if (xaiKey && providerConfig.xai?.apiKey) {
          xaiKey.value = providerConfig.xai.apiKey
        }
        if (nvidiaKey && providerConfig.nvidia_nim?.apiKey) {
          nvidiaKey.value = providerConfig.nvidia_nim.apiKey
        }
        if (hfKey && providerConfig.huggingface?.apiKey) {
          hfKey.value = providerConfig.huggingface.apiKey
        }
        if (tavilyKey && providerConfig.tavily?.apiKey) {
          tavilyKey.value = providerConfig.tavily.apiKey
        }

        // Populate agent provider selects (map provider names)
        const brainProvider = document.getElementById('brain-provider')
        if (brainProvider && providerConfig.brain?.provider) {
          brainProvider.value = providerConfig.brain.provider
        }
        const visionProvider = document.getElementById('vision-provider')
        if (visionProvider && providerConfig.vision?.provider) {
          visionProvider.value = providerConfig.vision.provider
        }
        const codeProvider = document.getElementById('code-provider')
        if (codeProvider && providerConfig.code?.provider) {
          codeProvider.value = providerConfig.code.provider
        }
      }
    } catch (e) {
      console.error('Load provider config failed:', e)
    }
  }

  // (Old EXTERNAL INTEGRATIONS SAVE/EDIT TOGGLE logic removed, now handled by individual edit buttons)

  // ========= MIC TOGGLE (Voice Input) =========
  const micBtn = document.getElementById('mic-btn')
  const micIconOff = document.getElementById('mic-icon-off')
  const micIconOn = document.getElementById('mic-icon-on')
  const micPulse = document.getElementById('mic-pulse')
  let isMicActive = false
  let recognition = null

  function toggleMic() {
    isMicActive = !isMicActive

    if (isMicActive) {
      micBtn.classList.add('mic-active')
      micIconOff.style.display = 'none'
      micIconOn.style.display = ''
      micPulse.style.display = ''
      voiceStatus.textContent = 'Voice: Listening...'
      startSpeechRecognition()
    } else {
      micBtn.classList.remove('mic-active')
      micIconOff.style.display = ''
      micIconOn.style.display = 'none'
      micPulse.style.display = 'none'
      voiceStatus.textContent = 'Voice: Standby'
      stopSpeechRecognition()
    }
  }

  function startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported')
      return
    }

    recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }
      if (finalTranscript.trim()) {
        chatInput.value = finalTranscript.trim()
        sendBtn.disabled = false
        // Auto-send after voice input
        sendMessage()
        // Turn off mic after capturing
        toggleMic()
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      if (isMicActive) toggleMic()
    }

    recognition.onend = () => {
      // Restart if still active (browser may stop it)
      if (isMicActive && recognition) {
        try {
          recognition.start()
        } catch (e) {
          /* already running */
        }
      }
    }

    try {
      recognition.start()
    } catch (e) {
      console.error('Could not start recognition:', e)
    }
  }

  function stopSpeechRecognition() {
    if (recognition) {
      try {
        recognition.stop()
      } catch (e) {
        /* ok */
      }
      recognition = null
    }
  }

  if (micBtn) {
    micBtn.addEventListener('click', () => toggleMic())
  }

  // Listen for Alt+Space from main process
  if (isElectron) {
    ipc.on('toggle-mic', () => toggleMic())
  }

  // ========= PHONE LINK (ADB) CONFIGURATION =========
  const phoneInfoBtn = document.getElementById('phone-info-btn')
  const phoneGuidePanel = document.getElementById('phone-guide-panel')
  const adbIpInput = document.getElementById('adb-ip')
  const adbPortInput = document.getElementById('adb-port')
  const adbConnectBtn = document.getElementById('adb-connect-btn')
  const adbDisconnectBtn = document.getElementById('adb-disconnect-btn')
  const phoneDashboard = document.getElementById('phone-dashboard')
  const phoneBattery = document.getElementById('phone-battery')
  const phoneStorage = document.getElementById('phone-storage')
  const phoneTemp = document.getElementById('phone-temp')
  let adbTelemetryInterval = null

  // QR Code Elements
  const adbQrBtn = document.getElementById('adb-qr-btn')
  const qrModal = document.getElementById('qr-modal')
  const closeQrBtn = document.getElementById('close-qr-btn')
  const qrCanvas = document.getElementById('qr-canvas')

  if (adbQrBtn && qrModal && closeQrBtn) {
    adbQrBtn.addEventListener('click', () => {
      qrModal.classList.remove('hidden')
      qrModal.classList.add('flex')
      // Generate QR for the current IP and Port (example format: tcpip://192.168.1.100:5555)
      const ip = adbIpInput.value.trim() || '192.168.1.x'
      const port = adbPortInput.value.trim() || '5555'
      const qrText = `tcpip://${ip}:${port}`

      if (typeof QRCode !== 'undefined') {
        QRCode.toCanvas(
          qrCanvas,
          qrText,
          { width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' } },
          function (error) {
            if (error) console.error(error)
          }
        )
      } else {
        showToast('QR Library failed to load.', 'error')
      }
    })

    closeQrBtn.addEventListener('click', () => {
      qrModal.classList.add('hidden')
      qrModal.classList.remove('flex')
    })
  }

  if (phoneInfoBtn && phoneGuidePanel) {
    phoneInfoBtn.addEventListener('click', () => {
      phoneGuidePanel.classList.toggle('hidden')
    })
  }

  if (adbConnectBtn && isElectron) {
    adbConnectBtn.addEventListener('click', async () => {
      const ip = adbIpInput.value.trim()
      const port = adbPortInput.value.trim() || '5555'
      if (!ip) return

      adbConnectBtn.textContent = 'CONNECTING...'
      adbConnectBtn.classList.add('opacity-50', 'pointer-events-none')

      const res = await ipc.invoke('adb-connect', { ip, port })
      adbConnectBtn.classList.remove('opacity-50', 'pointer-events-none')

      if (res && res.success) {
        adbConnectBtn.classList.add('hidden')
        adbDisconnectBtn.classList.remove('hidden')
        phoneDashboard.classList.remove('opacity-50', 'pointer-events-none')
        startAdbTelemetry()
      } else {
        adbConnectBtn.textContent = 'CONNECT'
        showToast(
          'Connection refused: ' + (res?.error || 'Ensure TCP/IP daemon is running.'),
          'error'
        )
      }
    })
  }

  if (adbDisconnectBtn && isElectron) {
    adbDisconnectBtn.addEventListener('click', async () => {
      await ipc.invoke('adb-disconnect')
      adbDisconnectBtn.classList.add('hidden')
      adbConnectBtn.classList.remove('hidden')
      adbConnectBtn.textContent = 'CONNECT'
      phoneDashboard.classList.add('opacity-50', 'pointer-events-none')
      if (adbTelemetryInterval) clearInterval(adbTelemetryInterval)
      phoneBattery.textContent = '--%'
      phoneTemp.textContent = '-- °C'
      phoneStorage.textContent = '-- / --'
    })
  }

  function startAdbTelemetry() {
    if (adbTelemetryInterval) clearInterval(adbTelemetryInterval)
    adbTelemetryInterval = setInterval(async () => {
      if (!isElectron) return
      const res = await ipc.invoke('adb-telemetry')
      if (res && res.success && res.data) {
        phoneBattery.textContent =
          res.data.battery?.level + '%' + (res.data.battery?.isCharging ? ' ⚡' : '')
        phoneTemp.textContent = res.data.battery?.temp + ' °C'
        phoneStorage.textContent = res.data.storage?.used + ' / ' + res.data.storage?.total
      }
    }, 5000)
  }

  // Phone Action Buttons
  document.querySelectorAll('.phone-action-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action
      if (isElectron && action) {
        btn.classList.add('scale-95', 'opacity-70')
        await ipc.invoke('adb-quick-action', { action })
        setTimeout(() => btn.classList.remove('scale-95', 'opacity-70'), 200)
      }
    })
  })
  // ========= WIDGETS CONFIGURATION =========
  const btnDeepResearch = document.getElementById('btn-deep-research')
  const btnLiveCode = document.getElementById('btn-live-code')
  const btnSmartDropzones = document.getElementById('btn-smart-dropzones')
  const btnGhostControl = document.getElementById('btn-ghost-control')

  if (btnDeepResearch) {
    btnDeepResearch.addEventListener('click', () => {
      if (isElectron) {
        // Switch to Research tab
        const researchTab = document.querySelector('[data-tab="research"]')
        if (researchTab) researchTab.click()
      } else {
        showToast('Deep Research requires Electron backend.', 'error')
      }
    })
  }

  if (btnLiveCode) {
    btnLiveCode.addEventListener('click', async () => {
      if (isElectron) {
        // Switch to chat tab with coding context
        const chatTab = document.querySelector('[data-tab="chat"]')
        if (chatTab) chatTab.click()
        if (chatInput) {
          chatInput.value = '[Code Mode] '
          chatInput.focus()
        }
      }
    })
  }

  if (btnSmartDropzones) {
    btnSmartDropzones.addEventListener('click', async () => {
      if (isElectron) {
        try {
          await ipc.invoke('dropzone-toggle')
          btnSmartDropzones.textContent = '✅ DropZones Active'
          setTimeout(() => {
            btnSmartDropzones.textContent = 'Configure Zones'
          }, 2000)
        } catch (e) {
          btnSmartDropzones.textContent = 'Configure Zones'
          console.error('DropZone error:', e)
        }
      }
    })
  }

  if (btnGhostControl) {
    btnGhostControl.addEventListener('click', async () => {
      if (isElectron) {
        if (confirm('⚠️ Ghost Control allows AI to simulate keyboard and mouse. Enable?')) {
          try {
            await ipc.invoke('ghost-toggle', { enabled: true })
            btnGhostControl.textContent = '🔴 Ghost Active'
            btnGhostControl.classList.remove('bg-rose-600')
            btnGhostControl.classList.add('bg-rose-800', 'animate-pulse')
          } catch (e) {
            console.error('Ghost control error:', e)
          }
        }
      } else {
        showToast('Ghost Control requires Native OS access.', 'error')
      }
    })
  }

  // ========= NEW TAB HANDLERS =========

  // Gallery Tab
  if (refreshGallery) {
    refreshGallery.addEventListener('click', async () => {
      if (isElectron) {
        try {
          const galleryData = await ipc.invoke('gallery-refresh')
          const galleryGrid = document.getElementById('gallery-grid')
          if (galleryGrid && galleryData) {
            galleryGrid.innerHTML = galleryData
              .map(
                (item) => `
              <div class="gallery-item bg-card rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors">
                <img src="${item.thumbnail}" alt="${item.name}" class="w-full h-32 object-cover">
                <div class="p-2">
                  <p class="text-xs font-medium truncate">${item.name}</p>
                  <p class="text-[10px] opacity-50">${item.size}</p>
                </div>
              </div>
            `
              )
              .join('')
          }
        } catch (err) {
          console.error('Gallery refresh failed:', err)
        }
      }
    })
  }

  // Notes Tab
  if (newNoteBtn) {
    newNoteBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          const noteId = await ipc.invoke('notes-new')
          if (noteId) {
            // Refresh notes list
            const notesList = document.getElementById('notes-list')
            if (notesList) {
              const notes = await ipc.invoke('notes-list')
              notesList.innerHTML = notes
                .map(
                  (note) => `
                <div class="note-item p-3 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer" data-note-id="${note.id}">
                  <h4 class="font-medium text-sm">${note.title}</h4>
                  <p class="text-xs opacity-70 mt-1">${note.preview}</p>
                  <p class="text-[10px] opacity-50 mt-2">${note.updated}</p>
                </div>
              `
                )
                .join('')
            }
          }
        } catch (err) {
          console.error('New note failed:', err)
        }
      }
    })
  }

  // Workflows Tab
  if (newWorkflowBtn) {
    newWorkflowBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          const workflowId = await ipc.invoke('workflows-new')
          if (workflowId) {
            // Refresh workflows list
            const workflowsList = document.getElementById('workflows-list')
            if (workflowsList) {
              const workflows = await ipc.invoke('workflows-list')
              workflowsList.innerHTML = workflows
                .map(
                  (wf) => `
                <div class="workflow-item p-3 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer" data-workflow-id="${wf.id}">
                  <h4 class="font-medium text-sm">${wf.name}</h4>
                  <p class="text-xs opacity-70 mt-1">${wf.description}</p>
                  <p class="text-[10px] opacity-50 mt-2">${wf.created}</p>
                </div>
              `
                )
                .join('')
            }
          }
        } catch (err) {
          console.error('New workflow failed:', err)
        }
      }
    })
  }

  // Biometric Tab
  async function loadEnrolledFaces() {
    if (!isElectron) return
    const enrolledContainer = document.getElementById('enrolled-faces')
    if (!enrolledContainer) return

    enrolledContainer.innerHTML = '<div class="text-sm opacity-50">Loading faces...</div>'
    try {
      const res = await ipc.invoke('biometric-list')
      if (res && res.success && res.faces && res.faces.length > 0) {
        enrolledContainer.innerHTML = res.faces
          .map(
            (f) => `
          <div class="flex items-center gap-3 p-3 rounded-xl border border-border bg-background">
            <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">${f.substring(0, 2).toUpperCase()}</div>
            <span class="text-sm font-medium">${f}</span>
          </div>
        `
          )
          .join('')
      } else {
        enrolledContainer.innerHTML = '<div class="text-sm opacity-50">No faces enrolled yet.</div>'
      }
    } catch (err) {
      console.error(err)
      enrolledContainer.innerHTML = '<div class="text-sm text-rose-500">Failed to load faces.</div>'
    }
  }

  // Hook into tab opening to load faces
  document.querySelector('[data-tab="biometric"]')?.addEventListener('click', loadEnrolledFaces)

  const biometricLockToggle = document.getElementById('biometric-lock-toggle')
  let autoLockInterval = null

  async function checkCameraAndToggle(state) {
    if (state) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const hasCamera = devices.some((d) => d.kind === 'videoinput')
        if (!hasCamera) {
          showToast('No camera attached. Cannot enable Auto-Lock.', 'error')
          biometricLockToggle.checked = false
          localStorage.setItem('biometricLock', 'false')
          return
        }
        showToast('Biometric Auto-Lock enabled.', 'success')
        localStorage.setItem('biometricLock', 'true')

        // Start Auto-Lock loop (checks every 2 mins)
        if (autoLockInterval) clearInterval(autoLockInterval)
        autoLockInterval = setInterval(async () => {
          if (isElectron) {
            try {
              const res = await ipc.invoke('biometric-test')
              if (!res) {
                ipc.send('trigger-lockdown')
              }
            } catch (e) {
              console.error('Lock check failed', e)
            }
          }
        }, 120000)
      } catch (err) {
        showToast('Camera check failed.', 'error')
        biometricLockToggle.checked = false
        localStorage.setItem('biometricLock', 'false')
      }
    } else {
      showToast('Biometric Auto-Lock disabled.', 'info')
      localStorage.setItem('biometricLock', 'false')
      if (autoLockInterval) clearInterval(autoLockInterval)
    }
  }

  if (biometricLockToggle) {
    const isLockOn = localStorage.getItem('biometricLock') === 'true'
    biometricLockToggle.checked = isLockOn
    if (isLockOn) checkCameraAndToggle(true)

    biometricLockToggle.addEventListener('change', (e) => {
      checkCameraAndToggle(e.target.checked)
    })
  }

  if (scanFaceBtn) {
    scanFaceBtn.addEventListener('click', async () => {
      scanFaceBtn.textContent = 'Scanning...'
      scanFaceBtn.classList.add('opacity-50', 'pointer-events-none')
      if (isElectron) {
        try {
          const result = await ipc.invoke('biometric-scan')
          if (result) showToast('Face detected and scanned.', 'success')
          else showToast('No face detected.', 'error')
        } catch (err) {
          showToast('Scan failed.', 'error')
        }
      } else {
        showToast('Scanning demo mode...', 'info')
      }
      scanFaceBtn.textContent = 'Scan Face'
      scanFaceBtn.classList.remove('opacity-50', 'pointer-events-none')
    })
  }

  if (enrollFaceBtn) {
    enrollFaceBtn.addEventListener('click', async () => {
      const name = prompt('Enter a name for this face:')
      if (!name) return
      enrollFaceBtn.textContent = 'Enrolling...'
      enrollFaceBtn.classList.add('opacity-50', 'pointer-events-none')
      if (isElectron) {
        try {
          const result = await ipc.invoke('biometric-enroll', { name })
          if (result) {
            showToast('Face enrolled successfully.', 'success')
            loadEnrolledFaces()
          } else {
            showToast('Enrollment failed.', 'error')
          }
        } catch (err) {
          showToast('Enrollment failed.', 'error')
        }
      } else {
        showToast('Enrolled demo face.', 'success')
      }
      enrollFaceBtn.textContent = 'Enroll New Face'
      enrollFaceBtn.classList.remove('opacity-50', 'pointer-events-none')
    })
  }

  if (testRecognitionBtn) {
    testRecognitionBtn.addEventListener('click', async () => {
      testRecognitionBtn.textContent = 'Testing...'
      testRecognitionBtn.classList.add('opacity-50', 'pointer-events-none')
      if (isElectron) {
        try {
          const result = await ipc.invoke('biometric-test')
          if (result) showToast('Face recognized successfully.', 'success')
          else showToast('Face recognition failed.', 'error')
        } catch (err) {
          showToast('Test failed.', 'error')
        }
      } else {
        showToast('Test passed in demo mode.', 'success')
      }
      testRecognitionBtn.textContent = 'Test Recognition'
      testRecognitionBtn.classList.remove('opacity-50', 'pointer-events-none')
    })
  }

  // Research Tab
  if (startResearchBtn) {
    startResearchBtn.addEventListener('click', async () => {
      const query = researchQuery.value.trim()
      if (!query) return

      if (isElectron) {
        try {
          const results = await ipc.invoke('research-start', { query })
          const researchResults = document.getElementById('research-results')
          if (researchResults) {
            researchResults.innerHTML = results
              .map(
                (result) => `
              <div class="research-item p-3 bg-card rounded-lg border border-border mb-2">
                <h4 class="font-medium text-sm">${result.title}</h4>
                <p class="text-xs opacity-70 mt-1">${result.snippet}</p>
                <a href="${result.url}" class="text-[10px] text-primary hover:underline mt-2 inline-block">${result.url}</a>
              </div>
            `
              )
              .join('')
          }
        } catch (err) {
          console.error('Research failed:', err)
        }
      }
    })
  }

  // Stocks Tab
  if (addStockBtn) {
    addStockBtn.addEventListener('click', async () => {
      const symbol = stockSymbol.value.trim().toUpperCase()
      if (!symbol) return

      if (isElectron) {
        try {
          const stockData = await ipc.invoke('stocks-add', { symbol })
          if (stockData) {
            // Refresh stocks list
            const stocksList = document.getElementById('stocks-list')
            if (stocksList) {
              const stocks = await ipc.invoke('stocks-list')
              stocksList.innerHTML = stocks
                .map(
                  (stock) => `
                <div class="stock-item p-3 bg-card rounded-lg border border-border mb-2">
                  <div class="flex justify-between items-center">
                    <h4 class="font-medium text-sm">${stock.symbol}</h4>
                    <span class="text-sm ${stock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${stock.price}</span>
                  </div>
                  <p class="text-xs opacity-70 mt-1">${stock.change >= 0 ? '+' : ''}${stock.change}%</p>
                </div>
              `
                )
                .join('')
            }
            stockSymbol.value = ''
          }
        } catch (err) {
          console.error('Add stock failed:', err)
        }
      }
    })
  }

  // Alerts Tab
  async function loadAlerts() {
    if (!isElectron) return
    try {
      const alerts = await ipc.invoke('alerts-list')
      const alertsList = document.getElementById('alerts-list')
      if (!alertsList) return
      if (!alerts || alerts.length === 0) {
        alertsList.innerHTML =
          '<div class="p-12 text-center border-2 border-dashed border-border rounded-3xl opacity-50"><p class="text-sm font-medium">No active alerts or notifications.</p></div>'
        return
      }
      alertsList.innerHTML = alerts
        .map(
          (a) => `
        <div class="p-4 rounded-2xl border bg-card border-border shadow-sm flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg ${a.type === 'error' ? 'bg-rose-500/10 text-rose-500' : a.type === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}">
            ${a.type === 'error' ? '🚨' : a.type === 'warning' ? '⚠️' : 'ℹ️'}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold truncate">${escapeHtml(a.title || a.message || 'Alert')}</p>
            <p class="text-xs opacity-50">${a.timestamp ? new Date(a.timestamp).toLocaleString() : ''}</p>
          </div>
        </div>
      `
        )
        .join('')
    } catch (e) {
      console.error('Load alerts failed:', e)
    }
  }

  if (clearAlertsBtn) {
    clearAlertsBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          await ipc.invoke('alerts-clear')
          loadAlerts()
        } catch (err) {
          console.error('Clear alerts failed:', err)
        }
      }
    })
  }

  // Privacy Tab
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          const success = await ipc.invoke('privacy-export')
          showToast(
            success ? 'Data exported successfully' : 'Export failed',
            success ? 'success' : 'error'
          )
        } catch (err) {
          console.error('Export failed:', err)
        }
      }
    })
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all chat history?')) {
        if (isElectron) {
          try {
            await ipc.invoke('privacy-clear-history')
            chatMessages.innerHTML = ''
          } catch (err) {
            console.error('Clear history failed:', err)
          }
        }
      }
    })
  }

  // Apps Tab
  if (refreshAppsBtn) {
    refreshAppsBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          const apps = await ipc.invoke('apps-refresh')
          const appsList = document.getElementById('apps-list')
          if (appsList && apps) {
            appsList.innerHTML = apps
              .map(
                (app) => `
              <div class="app-item p-3 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer" data-app-id="${app.id}" data-name="${app.name}">
                <div class="flex items-center gap-3">
                  <img src="${app.icon}" alt="${app.name}" class="w-8 h-8 rounded">
                  <div>
                    <h4 class="font-medium text-sm">${app.name}</h4>
                    <p class="text-xs opacity-50">${app.version}</p>
                  </div>
                </div>
              </div>
            `
              )
              .join('')
          }
        } catch (err) {
          console.error('Refresh apps failed:', err)
        }
      }
    })
  }

  if (appSearchInput) {
    appSearchInput.addEventListener('input', () => {
      const term = appSearchInput.value.toLowerCase()
      document.querySelectorAll('.app-item').forEach((item) => {
        const name = (item.dataset.name || '').toLowerCase()
        item.style.display = name.includes(term) ? '' : 'none'
      })
    })
  }

  // Also wire up the detailed tab's app-search input
  if (appSearch) {
    appSearch.addEventListener('input', () => {
      const term = appSearch.value.toLowerCase()
      document.querySelectorAll('#apps-grid .app-item').forEach((item) => {
        const name = (item.dataset.name || '').toLowerCase()
        item.style.display = name.includes(term) ? '' : 'none'
      })
    })
  }

  // Phone Link Tab
  if (connectPhoneBtn) {
    connectPhoneBtn.addEventListener('click', async () => {
      const ip = adbIp ? adbIp.value.trim() : ''
      const port = adbPort ? adbPort.value.trim() || '5555' : '5555'
      if (!ip) return

      if (isElectron) {
        try {
          connectPhoneBtn.textContent = 'Connecting...'
          connectPhoneBtn.disabled = true
          const res = await ipc.invoke('adb-connect', { ip, port })
          if (res && res.success) {
            connectPhoneBtn.textContent = '✅ Connected'
            connectPhoneBtn.classList.remove('bg-primary')
            connectPhoneBtn.classList.add('bg-emerald-500')
          } else {
            connectPhoneBtn.textContent = 'Connect'
            showToast('Connection failed: ' + (res?.error || 'Unknown error'), 'error')
          }
          connectPhoneBtn.disabled = false
        } catch (err) {
          connectPhoneBtn.textContent = 'Connect'
          connectPhoneBtn.disabled = false
          console.error('ADB connect failed:', err)
        }
      }
    })
  }

  if (phoneHomeBtn) {
    phoneHomeBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          await ipc.invoke('adb-quick-action', { action: 'home' })
        } catch (err) {
          console.error('ADB home failed:', err)
        }
      }
    })
  }

  if (phoneBackBtn) {
    phoneBackBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          await ipc.invoke('adb-quick-action', { action: 'back' })
        } catch (err) {
          console.error('ADB back failed:', err)
        }
      }
    })
  }

  if (phoneRecentBtn) {
    phoneRecentBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          await ipc.invoke('adb-quick-action', { action: 'recent' })
        } catch (err) {
          console.error('ADB recent failed:', err)
        }
      }
    })
  }

  if (phonePowerBtn) {
    phonePowerBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          await ipc.invoke('adb-quick-action', { action: 'power' })
        } catch (err) {
          console.error('ADB power failed:', err)
        }
      }
    })
  }

  if (phoneScreenshotBtn) {
    phoneScreenshotBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          const result = await ipc.invoke('adb-screenshot')
          if (result && result.success && result.image) {
            const img = document.createElement('img')
            img.src = result.image
            img.className = 'max-w-full rounded-lg'
            const phoneScreenshotDisplay = document.getElementById('phone-screenshot-display')
            if (phoneScreenshotDisplay) {
              phoneScreenshotDisplay.innerHTML = ''
              phoneScreenshotDisplay.appendChild(img)
            }
          }
        } catch (err) {
          console.error('ADB screenshot failed:', err)
        }
      }
    })
  }

  // Widgets Tab
  if (addWidgetBtn) {
    addWidgetBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          const widgetId = await ipc.invoke('widgets-add')
          if (widgetId) {
            // Refresh widgets list
            const widgetsList = document.getElementById('widgets-list')
            if (widgetsList) {
              const widgets = await ipc.invoke('widgets-list')
              widgetsList.innerHTML = widgets
                .map(
                  (widget) => `
                <div class="widget-item p-3 bg-card rounded-lg border border-border mb-2">
                  <h4 class="font-medium text-sm">${widget.name}</h4>
                  <p class="text-xs opacity-70 mt-1">${widget.description}</p>
                  <button class="mt-2 px-2 py-1 bg-primary text-primary-foreground rounded text-xs" onclick="removeWidget('${widget.id}')">Remove</button>
                </div>
              `
                )
                .join('')
            }
          }
        } catch (err) {
          console.error('Add widget failed:', err)
        }
      }
    })
  }

  // Make API key inputs editable on click
  ;[
    geminiKey,
    groqKey,
    openaiKey,
    anthropicKey,
    deepseekKey,
    mistralKey,
    openrouterKey,
    xaiKey,
    nvidiaKey,
    hfKey,
    tavilyKey
  ].forEach((input) => {
    if (input) {
      input.addEventListener('click', () => {
        if (input.hasAttribute('readonly')) {
          input.removeAttribute('readonly')
          input.focus()
        }
      })
      input.addEventListener('blur', () => {
        input.setAttribute('readonly', 'true')
      })
    }
  })

  if (saveKeysBtn) {
    saveKeysBtn.addEventListener('click', async () => {
      const config = {
        gemini: { apiKey: geminiKey.value.trim() },
        groq: { apiKey: groqKey.value.trim() },
        openai: { apiKey: openaiKey.value.trim() },
        anthropic: { apiKey: anthropicKey.value.trim() },
        deepseek: { apiKey: deepseekKey.value.trim() },
        mistral: { apiKey: mistralKey.value.trim() },
        openrouter: { apiKey: openrouterKey.value.trim() },
        xai: { apiKey: xaiKey.value.trim() },
        nvidia_nim: { apiKey: nvidiaKey.value.trim() },
        huggingface: { apiKey: hfKey.value.trim() },
        tavily: { apiKey: tavilyKey.value.trim() }
      }

      if (isElectron) {
        try {
          const success = await ipc.invoke('provider-save-config', config)
          if (success) {
            saveKeysBtn.textContent = '✅ Saved!'
            setTimeout(() => {
              saveKeysBtn.textContent = '💾 Save API Keys'
            }, 2000)
          } else {
            console.error('Save provider config failed')
          }
        } catch (err) {
          console.error('Save provider config failed:', err)
        }
      }
    })
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
      const settings = {
        voiceProfile: voiceProfile.value.trim(),
        userName: userName.value.trim(),
        personalityPrompt: personalityPrompt.value.trim()
      }

      if (isElectron) {
        try {
          await ipc.invoke('settings-save', settings)
          saveSettingsBtn.textContent = '✅ Saved!'
          setTimeout(() => {
            saveSettingsBtn.textContent = '💾 Save Settings'
          }, 2000)
        } catch (err) {
          console.error('Save settings failed:', err)
        }
      }
    })
  }

  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', async () => {
      if (confirm('Reset all settings to defaults?')) {
        if (isElectron) {
          try {
            await ipc.invoke('settings-reset')
            // Reload page or refresh UI
            location.reload()
          } catch (err) {
            console.error('Reset settings failed:', err)
          }
        }
      }
    })
  }

  // ========= COMMAND PALETTE (Ctrl+K) =========
  const cmdBackdrop = document.getElementById('cmd-palette-backdrop')
  const cmdPalette = document.getElementById('cmd-palette')
  const cmdInput = document.getElementById('cmd-input')
  const cmdResults = document.getElementById('cmd-results')

  const commands = [
    {
      name: 'Dashboard',
      icon: '🏠',
      action: () => document.querySelector('[data-tab="dashboard"]')?.click()
    },
    {
      name: 'Chat with IRIS',
      icon: '💬',
      action: () => document.querySelector('[data-tab="chat"]')?.click()
    },
    {
      name: 'System Monitor',
      icon: '📈',
      action: () => document.querySelector('[data-tab="monitor"]')?.click()
    },
    {
      name: 'Security & Defender',
      icon: '🛡️',
      action: () => document.querySelector('[data-tab="security"]')?.click()
    },
    {
      name: 'Phone Link (ADB)',
      icon: '📱',
      action: () => document.querySelector('[data-tab="phone"]')?.click()
    },
    {
      name: 'App Library',
      icon: '📦',
      action: () => document.querySelector('[data-tab="apps"]')?.click()
    },
    {
      name: 'Settings',
      icon: '⚙️',
      action: () => document.querySelector('[data-tab="settings"]')?.click()
    },
    {
      name: 'Toggle Dark Mode',
      icon: '🌗',
      action: () => document.getElementById('theme-toggle')?.click()
    },
    {
      name: 'Toggle Power',
      icon: '⚡',
      action: () => document.getElementById('power-btn')?.click()
    }
  ]

  function toggleCommandPalette(show) {
    if (!cmdBackdrop) return
    if (show) {
      cmdBackdrop.classList.remove('hidden')
      cmdBackdrop.classList.add('flex')
      // small delay to allow display:flex to apply before animating opacity/scale
      setTimeout(() => {
        cmdPalette.classList.remove('scale-95', 'opacity-0')
        cmdPalette.classList.add('scale-100', 'opacity-100')
        cmdInput.focus()
        cmdInput.value = ''
        renderCmdResults('')
      }, 10)
    } else {
      cmdPalette.classList.remove('scale-100', 'opacity-100')
      cmdPalette.classList.add('scale-95', 'opacity-0')
      setTimeout(() => {
        cmdBackdrop.classList.remove('flex')
        cmdBackdrop.classList.add('hidden')
      }, 200)
    }
  }

  function renderCmdResults(query) {
    if (!cmdResults) return
    const lowerQuery = query.toLowerCase()
    const filtered = commands.filter((c) => c.name.toLowerCase().includes(lowerQuery))

    if (filtered.length === 0) {
      cmdResults.innerHTML =
        '<div class="p-4 text-center opacity-50 text-sm">No commands found.</div>'
      return
    }

    cmdResults.innerHTML = filtered
      .map(
        (c, i) => `
      <div class="cmd-item p-3 rounded-xl hover:bg-accent cursor-pointer flex items-center gap-3 transition-colors ${i === 0 ? 'bg-accent' : ''}" data-index="${i}">
        <span class="text-xl">${c.icon}</span>
        <span class="text-sm font-medium">${c.name}</span>
      </div>
    `
      )
      .join('')

    const items = cmdResults.querySelectorAll('.cmd-item')
    items.forEach((item) => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.getAttribute('data-index'))
        filtered[idx].action()
        toggleCommandPalette(false)
      })
      item.addEventListener('mouseenter', () => {
        items.forEach((i) => i.classList.remove('bg-accent'))
        item.classList.add('bg-accent')
      })
    })
  }

  if (cmdInput) {
    cmdInput.addEventListener('input', (e) => renderCmdResults(e.target.value))
    cmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const active = cmdResults.querySelector('.cmd-item.bg-accent')
        if (active) active.click()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = Array.from(cmdResults.querySelectorAll('.cmd-item'))
        if (!items.length) return
        const currentIdx = items.findIndex((i) => i.classList.contains('bg-accent'))
        items.forEach((i) => i.classList.remove('bg-accent'))
        let nextIdx = e.key === 'ArrowDown' ? currentIdx + 1 : currentIdx - 1
        if (nextIdx >= items.length) nextIdx = 0
        if (nextIdx < 0) nextIdx = items.length - 1
        items[nextIdx].classList.add('bg-accent')
        items[nextIdx].scrollIntoView({ block: 'nearest' })
      }
    })
  }

  if (cmdBackdrop) {
    cmdBackdrop.addEventListener('click', (e) => {
      if (e.target === cmdBackdrop) toggleCommandPalette(false)
    })
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      const isVisible = !cmdBackdrop.classList.contains('hidden')
      toggleCommandPalette(!isVisible)
    }
    if (e.key === 'Escape' && !cmdBackdrop.classList.contains('hidden')) {
      toggleCommandPalette(false)
    }
  })
  // --- Auto Updater UI ---
  if (isElectron) {
    const updaterUi = document.getElementById('updater-ui')
    const updaterText = document.getElementById('updater-text')
    const updaterProgress = document.getElementById('updater-progress')

    window.electron.ipcRenderer.on('updater-event', (_, payload) => {
      if (!updaterUi) return
      updaterUi.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-20')

      if (payload.type === 'available') {
        updaterText.textContent = 'Downloading update...'
      } else if (payload.type === 'not-available') {
        updaterText.textContent = 'System is up to date'
        setTimeout(
          () => updaterUi.classList.add('opacity-0', 'pointer-events-none', '-translate-y-20'),
          3000
        )
      } else if (payload.type === 'progress') {
        updaterText.textContent = `Downloading... ${Math.round(payload.progress)}%`
        if (updaterProgress) updaterProgress.style.width = `${payload.progress}%`
      } else if (payload.type === 'downloaded') {
        updaterText.textContent = 'Update ready. Restarting...'
        if (updaterProgress) updaterProgress.style.width = '100%'
        setTimeout(() => window.electron.ipcRenderer.send('window-close'), 2000)
      }
    })
  }

  // --- System Monitor Charts ---
  let cpuChart, ramChart

  function initCharts() {
    const cpuCtx = document.getElementById('cpu-chart')?.getContext('2d')
    const ramCtx = document.getElementById('ram-chart')?.getContext('2d')

    if (!cpuCtx || !ramCtx || typeof Chart === 'undefined') return

    Chart.defaults.color = 'rgba(255, 255, 255, 0.5)'
    Chart.defaults.font.family = 'Inter, sans-serif'

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { min: 0, max: 100, display: false }
      },
      animation: { duration: 0 },
      elements: { point: { radius: 0 } }
    }

    cpuChart = new Chart(cpuCtx, {
      type: 'line',
      data: {
        labels: Array(20).fill(''),
        datasets: [
          {
            data: Array(20).fill(0),
            borderColor: '#3b82f6',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            backgroundColor: 'rgba(59, 130, 246, 0.1)'
          }
        ]
      },
      options: commonOptions
    })

    ramChart = new Chart(ramCtx, {
      type: 'line',
      data: {
        labels: Array(20).fill(''),
        datasets: [
          {
            data: Array(20).fill(0),
            borderColor: '#f43f5e',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            backgroundColor: 'rgba(244, 63, 94, 0.1)'
          }
        ]
      },
      options: commonOptions
    })
  }

  async function updateSystemStats() {
    if (!isElectron) return
    try {
      const stats = await ipc.invoke('get-system-stats')
      if (!stats) return

      const cpuVal = parseFloat(stats.cpu)
      const ramVal = parseFloat(stats.memory.usedPercentage)

      const cpuValueEl = document.getElementById('cpu-value')
      const ramValueEl = document.getElementById('ram-value')
      const ramUsedEl = document.getElementById('ram-used')

      if (cpuValueEl) cpuValueEl.textContent = `${Math.round(cpuVal)}%`
      if (ramValueEl) ramValueEl.textContent = `${Math.round(ramVal)}%`
      if (ramUsedEl) ramUsedEl.textContent = `${stats.memory.total} / ${stats.memory.free} FREE`

      if (cpuChart) {
        cpuChart.data.datasets[0].data.shift()
        cpuChart.data.datasets[0].data.push(cpuVal)
        cpuChart.update()
      }

      if (ramChart) {
        ramChart.data.datasets[0].data.shift()
        ramChart.data.datasets[0].data.push(ramVal)
        ramChart.update()
      }
    } catch (e) {
      console.error('Failed to update system stats:', e)
    }
  }

  setTimeout(() => {
    initCharts()
    setInterval(updateSystemStats, 2000)
    updateSystemStats()
  }, 1000)
})()
