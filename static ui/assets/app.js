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
  window.isPowerOn = false
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
      if (tabId === 'monitor' && window.isPowerOn) {
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
    window.isPowerOn = !window.isPowerOn

    if (window.isPowerOn) {
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
  function startPollingStats() {
    if (window.SystemMonitor) window.SystemMonitor.startPolling()
  }

  function stopPollingStats() {
    if (window.SystemMonitor) window.SystemMonitor.stopPolling()
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
    if (window.SystemMonitor) await window.SystemMonitor.updateNow()
  }

  // ========= CHAT → Delegated to chat-ui.js =========
  // All chat input, sendMessage, appendMessage, history, and image upload
  // logic is now handled by the ChatUI module (window.ChatUI).
  // Thin delegates for backward-compatibility with other parts of app.js:
  function appendMessage(role, text) {
    if (window.ChatUI) window.ChatUI.appendMessage(role, text)
  }
  function speakAndAnimate(text) {
    if (window.ChatUI) window.ChatUI.speakAndAnimate(text)
  }
  function escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

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
    if (!window.isPowerOn) {
      if (typeof showToast !== 'undefined') showToast('Please start MJ first.', 'warning');
      return;
    }

    if (!isMicActive) {
      // Turn ON
      isMicActive = true;
      window.__mj_inputMode = 'voice';
      initAudioEngine();
      if (voiceStatus) voiceStatus.textContent = 'Voice: Listening'
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
        chatInput.placeholder = 'Voice mode — responses will be spoken aloud...';
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
              // Mark this input as coming from voice so TTS responds aloud
              window.__mj_inputMode = 'voice';
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
      window.__mj_inputMode = 'text';
      if (microphone) {
        microphone.disconnect();
        microphone = null;
      }
      
      if (voiceStatus) voiceStatus.textContent = 'Voice: Text Mode'
      
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
        chatInput.placeholder = 'Type a message... (text-only, no voice output)';
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
      
      if (!root || !window.isPowerOn) {
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

  // --- speakAndAnimate, appendMessage, escapeHtml, and Image Upload ---
  // All moved to chat-ui.js. Delegates already defined above.
  
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
        { key: 'google', name: 'Google AI', icon: '🌐' },
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
          opt.dataset.role = 'provider'
          agentSelectEl.appendChild(opt)
        }
      })

      // Add sub-agent role types (brain/vision/code) based on provider config
      const subAgentRoles = [
        { key: 'brain', name: '🧠 Brain (Reasoning)', provider: providerConfig.brain?.provider || 'groq', icon: '🧠' },
        { key: 'vision', name: '👁️ Vision (Image/Visual)', provider: providerConfig.vision?.provider || 'gemini', icon: '👁️' },
        { key: 'code', name: '💻 Code (Programming)', provider: providerConfig.code?.provider || 'openai', icon: '💻' }
      ]

      subAgentRoles.forEach((role) => {
        // Only show role if its underlying provider has an API key
        const roleProvider = role.provider
        if (providerConfig[roleProvider]?.apiKey || providerConfig.gemini?.apiKey || providerConfig.google?.apiKey) {
          const opt = document.createElement('option')
          opt.value = role.provider
          opt.textContent = role.name
          opt.dataset.role = 'subagent'
          opt.dataset.subagentKey = role.key
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
      const provider = prompt('Enter provider to route through (gemini, google, groq, openai, anthropic, deepseek, etc.):')
      if (!provider || !provider.trim()) return
      if (agentSelectEl) {
        const opt = document.createElement('option')
        opt.value = provider.trim().toLowerCase()
        opt.textContent = `${name.trim()} (${provider.trim()})`
        opt.dataset.role = 'custom'
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
    const selectedOption = agentSelectEl ? agentSelectEl.options[agentSelectEl.selectedIndex] : null
    const selectedAgentName = selectedOption?.text || 'AI'
    const optionRole = selectedOption?.dataset?.role || 'provider'
    const subagentKey = selectedOption?.dataset?.subagentKey || ''

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
        let reply = null

        // If a subagent role is selected (brain/vision/code), try orchestrator dispatch first
        if (optionRole === 'subagent' && subagentKey && subagentKey !== '') {
          try {
            // Check if any teams exist, create a default one if not
            const teams = await ipc.invoke('agent-list-teams')
            let teamId = teams && teams.length > 0 ? teams[0].id : null

            if (!teamId) {
              // Create a default team for sub-agent dispatch
              const createResult = await ipc.invoke('agent-create-team', {
                name: 'MJ Default Team',
                description: 'Default team for sub-agent task routing'
              })
              if (createResult.success) {
                teamId = createResult.team.id
              }
            }

            if (teamId) {
              // Dispatch via orchestrator with role-specific prompt
              const rolePrompt = subagentKey === 'brain' ? 'As a reasoning specialist' : subagentKey === 'vision' ? 'As a visual/image specialist' : subagentKey === 'code' ? 'As a code/programming specialist' : ''
              const dispatchResult = await ipc.invoke('agent-dispatch', {
                teamId: teamId,
                request: `${rolePrompt}: ${text}`
              })
              if (dispatchResult.success) {
                reply = dispatchResult.result || dispatchResult.output || JSON.stringify(dispatchResult)
              }
            }
          } catch (orchErr) {
            console.log('[SubAgent] Orchestrator dispatch failed, falling back to chat-with-ai:', orchErr)
          }
        }

        // Fallback: route to specific provider via chat-with-ai
        if (!reply) {
          reply = await ipc.invoke('chat-with-ai', {
            text: text,
            provider: selectedProvider
          })
        }

        const isError =
          typeof reply === 'string' && /(^ERROR:|\bError:|\bFailed\b|\bfailed\b)/.test(reply)
        const content = escapeHtml(typeof reply === 'string' ? reply : JSON.stringify(reply))
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
    // Delegated to system-monitor.js
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
  const PROVIDER_MODELS = {
    openai: [
      { id: 'gpt-4o', name: 'GPT-4o', tag: 'Best overall', speed: 'med', context: '128K', tier: 'paid' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Fast & cheap', speed: 'fast', context: '128K', tier: 'low-cost' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', tag: 'Legacy', speed: 'slow', context: '128K', tier: 'paid' }
    ],
    gemini: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'Latest', speed: 'fast', context: '1M', tier: 'free' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tag: 'Fast', speed: 'fast', context: '1M', tier: 'free' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tag: 'Reasoning', speed: 'slow', context: '2M', tier: 'paid' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tag: 'Budget', speed: 'fast', context: '1M', tier: 'free' }
    ],
    google: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'Latest', speed: 'fast', context: '1M', tier: 'free' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tag: 'Fast', speed: 'fast', context: '1M', tier: 'free' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tag: 'Reasoning', speed: 'slow', context: '2M', tier: 'paid' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tag: 'Budget', speed: 'fast', context: '1M', tier: 'free' }
    ],
    groq: [
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', tag: 'Fastest', speed: 'fast', context: '128K', tier: 'free' },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', tag: 'Versatile', speed: 'med', context: '128K', tier: 'free' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', tag: 'MoE', speed: 'med', context: '32K', tier: 'free' }
    ],
    anthropic: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tag: 'Best', speed: 'med', context: '200K', tier: 'paid' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tag: 'Fast & cheap', speed: 'fast', context: '200K', tier: 'low-cost' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', tag: 'Reasoning', speed: 'slow', context: '200K', tier: 'paid' }
    ],
    deepseek: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', tag: 'General', speed: 'med', context: '64K', tier: 'free' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', tag: 'Reasoning', speed: 'slow', context: '64K', tier: 'free' }
    ]
  };

  async function loadSavedKeys() {
    if (!isElectron) return
    try {
      providerConfig = await ipc.invoke('provider-load-config')
      if (providerConfig) {
        // Populate API key fields and show status indicators
        const keyFields = [
          { input: geminiKey, provider: 'gemini', label: 'Google Gemini' },
          { input: groqKey, provider: 'groq', label: 'Groq' },
          { input: openaiKey, provider: 'openai', label: 'OpenAI' },
          { input: anthropicKey, provider: 'anthropic', label: 'Anthropic' },
          { input: deepseekKey, provider: 'deepseek', label: 'DeepSeek' },
          { input: mistralKey, provider: 'mistral', label: 'Mistral' },
          { input: openrouterKey, provider: 'openrouter', label: 'OpenRouter' },
          { input: xaiKey, provider: 'xai', label: 'xAI' },
          { input: nvidiaKey, provider: 'nvidia_nim', label: 'Nvidia NIM' },
          { input: hfKey, provider: 'huggingface', label: 'Hugging Face' },
          { input: tavilyKey, provider: 'tavily', label: 'Tavily' }
        ];

        keyFields.forEach(({ input, provider, label }) => {
          if (!input) return;
          const hasKey = !!providerConfig[provider]?.apiKey;
          if (hasKey) input.value = providerConfig[provider].apiKey;

          // Remove old status indicator if exists
          const oldStatus = input.parentElement.querySelector('.key-status');
          if (oldStatus) oldStatus.remove();

          // Add status indicator
          const status = document.createElement('span');
          status.className = 'key-status text-[10px] font-semibold ml-1 ' + (hasKey ? 'text-green-400' : 'text-zinc-500');
          status.textContent = hasKey ? '✓ Saved' : '— No key';
          input.parentElement.appendChild(status);
        });

        // Populate Primary Provider Dropdown based on available keys
        const primaryProvider = document.getElementById('primary-provider');
        const primaryModel = document.getElementById('primary-model');
        
        if (primaryProvider && primaryModel) {
            primaryProvider.innerHTML = '<option value="" disabled selected>Select Provider...</option>';
            
            const availableProviders = [];
            if (providerConfig.openai?.apiKey) availableProviders.push({ id: 'openai', name: 'OpenAI (GPT)' });
            if (providerConfig.gemini?.apiKey || providerConfig.google?.apiKey) availableProviders.push({ id: 'gemini', name: 'Google (Gemini)' });
            if (providerConfig.google?.apiKey) availableProviders.push({ id: 'google', name: 'Google AI' });
            if (providerConfig.groq?.apiKey) availableProviders.push({ id: 'groq', name: 'Groq (Llama)' });
            if (providerConfig.anthropic?.apiKey) availableProviders.push({ id: 'anthropic', name: 'Anthropic (Claude)' });
            if (providerConfig.deepseek?.apiKey) availableProviders.push({ id: 'deepseek', name: 'DeepSeek' });
            if (providerConfig.mistral?.apiKey) availableProviders.push({ id: 'mistral', name: 'Mistral' });
            if (providerConfig.openrouter?.apiKey) availableProviders.push({ id: 'openrouter', name: 'OpenRouter' });
            if (providerConfig.xai?.apiKey) availableProviders.push({ id: 'xai', name: 'xAI (Grok)' });
            if (providerConfig.huggingface?.apiKey) availableProviders.push({ id: 'huggingface', name: 'Hugging Face' });
            if (providerConfig.nvidia_nim?.apiKey) availableProviders.push({ id: 'nvidia_nim', name: 'Nvidia NIM' });
            if (providerConfig.tavily?.apiKey) availableProviders.push({ id: 'tavily', name: 'Tavily' });

            availableProviders.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                primaryProvider.appendChild(opt);
            });

            // Set saved primary config if exists
            if (providerConfig.primary_agent) {
                if (availableProviders.find(p => p.id === providerConfig.primary_agent.provider)) {
                    primaryProvider.value = providerConfig.primary_agent.provider;
                    // Trigger model population via populateModelsForProvider
                    populateModelsForProvider(providerConfig.primary_agent.provider, primaryModel);
                    // Set the saved model value if it exists in the dropdown
                    const savedModel = providerConfig.primary_agent.model;
                    if (savedModel) {
                        const modelOption = primaryModel.querySelector(`option[value="${savedModel}"]`);
                        if (modelOption) {
                            primaryModel.value = savedModel;
                        } else {
                            // Model not in list — add it as a custom option
                            const customOpt = document.createElement('option');
                            customOpt.value = savedModel;
                            customOpt.textContent = savedModel + ' (custom)';
                            primaryModel.appendChild(customOpt);
                            primaryModel.value = savedModel;
                        }
                    }
                }
            }
        }
      }
    } catch (e) {
      console.error('Load provider config failed:', e)
    }
  }

  // Populate model dropdown for a given provider (separated from loadSavedKeys to avoid duplicate listeners)
  function populateModelsForProvider(provider, modelSelect) {
    if (!modelSelect) return;
    modelSelect.innerHTML = '<option value="" disabled selected>Select Model...</option>';
    if (PROVIDER_MODELS[provider]) {
        modelSelect.disabled = false;
        PROVIDER_MODELS[provider].forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            const tierIcon = m.tier === 'free' ? '🟢' : m.tier === 'low-cost' ? '🟡' : '🔴';
            const speedIcon = m.speed === 'fast' ? '⚡' : m.speed === 'med' ? '➡️' : '🐢';
            opt.textContent = `${m.name} — ${m.tag} | ${speedIcon}${m.speed} | ${m.context} | ${tierIcon}${m.tier}`;
            modelSelect.appendChild(opt);
        });
    } else {
        modelSelect.disabled = false;
        modelSelect.innerHTML = '<option value="" disabled selected>Enter model name manually</option>';
        // For providers without predefined models, add a text input option
        const defaultOpt = document.createElement('option');
        defaultOpt.value = 'default';
        defaultOpt.textContent = 'Default Model';
        modelSelect.appendChild(defaultOpt);
    }
  }

  // One-time setup of primary provider change listener (never re-registered)
  const _primaryProviderEl = document.getElementById('primary-provider');
  const _primaryModelEl = document.getElementById('primary-model');
  if (_primaryProviderEl && _primaryModelEl) {
    _primaryProviderEl.addEventListener('change', (e) => {
        populateModelsForProvider(e.target.value, _primaryModelEl);
    });
  }

  // (Old EXTERNAL INTEGRATIONS SAVE/EDIT TOGGLE logic removed, now handled by individual edit buttons)

  // NOTE: MIC TOGGLE is handled above in the Audio Engine section (line ~450-584)
  // Listen for Alt+Space from main process
  if (isElectron) {
    ipc.on('toggle-mic', () => toggleMicrophone())
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

  // Ghost Control — proper toggle with state sync
  let ghostControlEnabled = false

  async function syncGhostControlState() {
    if (!isElectron) return
    try {
      const state = await ipc.invoke('ghost-get-state')
      ghostControlEnabled = state?.enabled || false
      updateGhostControlUI()
    } catch (e) {
      console.error('Ghost control state sync failed:', e)
    }
  }

  function updateGhostControlUI() {
    if (!btnGhostControl) return
    if (ghostControlEnabled) {
      btnGhostControl.textContent = '🔴 Ghost Active'
      btnGhostControl.classList.remove('bg-rose-600')
      btnGhostControl.classList.add('bg-rose-800', 'animate-pulse')
    } else {
      btnGhostControl.textContent = 'Enable Ghost Control'
      btnGhostControl.classList.remove('bg-rose-800', 'animate-pulse')
      btnGhostControl.classList.add('bg-rose-600')
    }
  }

  if (btnGhostControl) {
    btnGhostControl.addEventListener('click', async () => {
      if (!isElectron) {
        showToast('Ghost Control requires Native OS access.', 'error')
        return
      }

      const nextState = !ghostControlEnabled
      const actionLabel = nextState ? 'Enable' : 'Disable'
      if (confirm(`⚠️ ${actionLabel} Ghost Control? This allows AI to simulate keyboard and mouse.`)) {
        try {
          await ipc.invoke('ghost-toggle', { enabled: nextState })
          ghostControlEnabled = nextState
          updateGhostControlUI()
        } catch (e) {
          console.error('Ghost control error:', e)
        }
      }
    })

    // Sync state on load
    syncGhostControlState()
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
        google: { apiKey: geminiKey.value.trim() },
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

      const primaryProvider = document.getElementById('primary-provider');
      const primaryModel = document.getElementById('primary-model');
      if (primaryProvider && primaryProvider.value) {
          const selectedModel = primaryModel.value;
          config.primary_agent = {
              provider: primaryProvider.value,
              model: (selectedModel && selectedModel !== 'default' && selectedModel !== '') ? selectedModel : undefined
          };
      }

      if (isElectron) {
        try {
          const success = await ipc.invoke('provider-save-config', config)
          if (success) {
            saveKeysBtn.textContent = '✅ Saved!'
            // Show per-key save status
            const keyInputs = [geminiKey, groqKey, openaiKey, anthropicKey, deepseekKey, mistralKey, openrouterKey, xaiKey, nvidiaKey, hfKey, tavilyKey];
            const keyNames = ['gemini', 'groq', 'openai', 'anthropic', 'deepseek', 'mistral', 'openrouter', 'xai', 'nvidia_nim', 'huggingface', 'tavily'];
            keyInputs.forEach((input, i) => {
              if (!input) return;
              const oldStatus = input.parentElement.querySelector('.key-status');
              if (oldStatus) oldStatus.remove();
              const hasKey = !!input.value.trim();
              const status = document.createElement('span');
              status.className = 'key-status text-[10px] font-semibold ml-1 ' + (hasKey ? 'text-green-400' : 'text-zinc-500');
              status.textContent = hasKey ? '✓ Saved' : '— No key';
              input.parentElement.appendChild(status);
            });
            // Refresh the available primary providers based on new keys
            loadSavedKeys()
            setTimeout(() => {
              saveKeysBtn.textContent = '💾 Save API Keys'
            }, 2000)
          } else {
            saveKeysBtn.textContent = '❌ Save Failed'
            setTimeout(() => {
              saveKeysBtn.textContent = '💾 Save API Keys'
            }, 2000)
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
    if (window.SystemMonitor) window.SystemMonitor.init()
  }

  setTimeout(() => {
    initCharts()
  }, 1000)

  document.getElementById('btn-lock-system')?.addEventListener('click', () => {
    if (isElectron) ipc.send('trigger-lockdown')
  })
  // --- Lock Screen Logic ---
  const lockOverlay = document.getElementById('lock-screen-overlay')
  const lockPinInput = document.getElementById('lock-pin-input')
  const lockUnlockBtn = document.getElementById('lock-unlock-btn')
  const lockBiometricBtn = document.getElementById('lock-biometric-btn')
  const lockErrorMsg = document.getElementById('lock-error-msg')

  if (isElectron && lockOverlay && lockPinInput && lockUnlockBtn && lockErrorMsg) {
    ipc.on('lock-screen-show', () => {
      lockOverlay.classList.remove('hidden')
      lockPinInput.value = ''
      lockPinInput.focus()
      lockErrorMsg.classList.add('opacity-0')
      
      // Reset biometric btn state if it was loading
      if (lockBiometricBtn) {
        lockBiometricBtn.disabled = false
        lockBiometricBtn.innerHTML = '<i class="ri-user-smile-line text-lg"></i> Face ID'
      }
    })

    ipc.on('lock-screen-hide', () => {
      lockOverlay.classList.add('hidden')
    })

    const tryUnlock = async () => {
      const pin = lockPinInput.value
      if (!pin) return
      lockUnlockBtn.disabled = true
      lockUnlockBtn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i>'
      
      const res = await ipc.invoke('verify-pin', pin)
      if (res && res.success) {
        lockOverlay.classList.add('hidden')
        lockErrorMsg.classList.add('opacity-0')
      } else {
        lockErrorMsg.classList.remove('opacity-0')
        lockErrorMsg.textContent = 'Incorrect PIN'
        lockPinInput.value = ''
        lockPinInput.focus()
      }
      lockUnlockBtn.disabled = false
      lockUnlockBtn.innerHTML = 'Unlock System'
    }
    
    const tryBiometricUnlock = async () => {
      if (!lockBiometricBtn) return
      lockBiometricBtn.disabled = true
      lockBiometricBtn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Scanning...'
      lockErrorMsg.classList.add('opacity-0')
      
      try {
        const res = await ipc.invoke('biometric-test')
        if (res) {
          // Success! Unlock the system explicitly
          await ipc.invoke('verify-pin', 'ADMIN_BYPASS_NO_PIN') // We will update backend to accept biometric override
        } else {
          lockErrorMsg.textContent = 'Face not recognized.'
          lockErrorMsg.classList.remove('opacity-0')
        }
      } catch (err) {
        lockErrorMsg.textContent = 'Camera error.'
        lockErrorMsg.classList.remove('opacity-0')
      }
      
      lockBiometricBtn.disabled = false
      lockBiometricBtn.innerHTML = '<i class="ri-user-smile-line text-lg"></i> Face ID'
    }

    lockUnlockBtn.addEventListener('click', tryUnlock)
    if (lockBiometricBtn) lockBiometricBtn.addEventListener('click', tryBiometricUnlock)
    lockPinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') tryUnlock()
    })
  }

})()
