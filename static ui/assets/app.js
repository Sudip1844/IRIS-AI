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
  let isDarkMode = false
  let isSidebarExpanded = false
  let statsInterval = null

  // --- DOM refs ---
  const sidebar = document.getElementById('sidebar')
  const sidebarToggle = document.getElementById('sidebar-toggle')
  const themeToggle = document.getElementById('theme-toggle')
  const iconSun = document.getElementById('icon-sun')
  const iconMoon = document.getElementById('icon-moon')
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

  // --- Theme Toggle ---
  themeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode
    document.documentElement.classList.toggle('dark', isDarkMode)
    iconSun.style.display = isDarkMode ? 'none' : ''
    iconMoon.style.display = isDarkMode ? '' : 'none'
  })

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
      voiceStatus.textContent = 'Voice: Listening...'

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

    if (isElectron) {
      // Route the chat message through the IRIS AI backend
      try {
        // Fetch user preferences directly inside backend or frontend
        // The new handler 'chat-with-ai' is created in the backend
        const result = await ipc.invoke('chat-with-ai', text)
        thinkingEl.remove()
        appendMessage('mj', result || 'No response.')
      } catch (err) {
        thinkingEl.remove()
        appendMessage('error', 'Backend error: ' + err.message)
      }
    } else {
      // Static demo fallback
      setTimeout(() => {
        thinkingEl.remove()
        appendMessage(
          'mj',
          'I received: "' + text + '". Connect to Electron backend for full AI functionality.'
        )
      }, 1500)
    }
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

    wrapper.innerHTML =
      '<div class="flex items-center gap-2 px-2">' +
      headerHTML +
      '</div>' +
      '<div class="max-w-[90%] md:max-w-[85%] rounded-2xl p-3 md:p-4 text-xs md:text-sm leading-relaxed shadow-sm ' +
      bubbleClass +
      '">' +
      '<div class="prose prose-sm max-w-none"><p>' +
      escapeHtml(text) +
      '</p></div></div>'

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
      if (file) {
        const reader = new FileReader()
        reader.onloadend = () => {
          previewImg.src = reader.result
          imagePreview.style.display = 'flex'
          sendBtn.disabled = false
        }
        reader.readAsDataURL(file)
      }
    })
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
      if (vizPreview && vizTemplates[type]) {
        vizPreview.innerHTML = vizTemplates[type]
      }
    })
  })

  // --- Sub Agent Input ---
  const subagentInput = document.getElementById('subagent-input')
  const subagentSend = document.getElementById('subagent-send')

  if (subagentInput) {
    subagentInput.addEventListener('input', () => {
      subagentSend.disabled = !subagentInput.value.trim()
    })
    subagentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (subagentInput.value.trim()) {
          alert('Sub Agent API integration requires backend configuration.')
          subagentInput.value = ''
          subagentSend.disabled = true
        }
      }
    })
  }
  if (subagentSend) {
    subagentSend.addEventListener('click', () => {
      alert('Sub Agent API integration requires backend configuration.')
    })
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
        // Populate bottom grid
        appsGrid.innerHTML = apps
          .slice(0, 50)
          .map(
            (a) => `
                    <div class="app-item p-3 md:p-4 rounded-xl md:rounded-2xl bg-card border border-border flex items-center justify-between hover:border-primary/30 transition-colors group" data-name="${escapeHtml(a.name)}">
                        <div class="flex items-center gap-2 md:gap-3 min-w-0">
                            <div class="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-accent flex items-center justify-center shrink-0 text-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 md:w-5 md:h-5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                            </div>
                            <span class="font-bold text-xs md:text-sm truncate">${escapeHtml(a.name)}</span>
                        </div>
                    </div>
                `
          )
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
    try {
      const items = await ipc.invoke('quarantine-list')
      if (!items || items.length === 0) {
        quarantineListEl.innerHTML =
          '<div class="p-6 text-center border-2 border-dashed border-border rounded-2xl opacity-50"><p class="text-sm font-medium">🛡️ No files in quarantine.</p><p class="text-xs opacity-50 mt-1">Suspicious files will appear here for your review.</p></div>'
        return
      }
      quarantineListEl.innerHTML = items
        .map(
          (item) => `
                <div class="flex items-center justify-between p-4 rounded-xl bg-background border border-amber-500/20 hover:border-amber-500/40 transition-colors" data-qid="${item.id}">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold truncate">${item.originalPath.split('\\\\').pop() || item.originalPath.split('/').pop()}</p>
                        <p class="text-[10px] opacity-50 truncate">${item.reason}</p>
                        <p class="text-[10px] opacity-30">${new Date(item.timestamp).toLocaleString()}</p>
                    </div>
                    <div class="flex gap-2 ml-3 shrink-0">
                        <button onclick="restoreQuarantined('${item.id}')" class="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-bold hover:bg-emerald-500 hover:text-white transition-all">Restore</button>
                        <button onclick="deleteQuarantined('${item.id}')" class="px-3 py-1 bg-rose-500/10 text-rose-500 rounded-lg text-[10px] font-bold hover:bg-rose-500 hover:text-white transition-all">Delete</button>
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
    await ipc.invoke('quarantine-restore', id)
    loadQuarantine()
  }

  window.deleteQuarantined = async function (id) {
    if (!isElectron) return
    await ipc.invoke('quarantine-delete', id)
    loadQuarantine()
  }

  if (refreshQuarantineBtn) refreshQuarantineBtn.addEventListener('click', loadQuarantine)
  // Auto-load on settings tab open
  document
    .querySelector('[data-tab="settings"]')
    ?.addEventListener('click', () => setTimeout(loadQuarantine, 200))

  // ========= SAVE AGENT API KEYS =========
  const saveAgentBtn = document.getElementById('save-agent-config')
  if (saveAgentBtn) {
    saveAgentBtn.addEventListener('click', async () => {
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
        image: document.getElementById('image-api-key')?.value || ''
      }

      if (isElectron) {
        try {
          await ipc.invoke('secure-save-keys', {
            groqKey: JSON.stringify(config),
            geminiKey: config.brain.key
          })
          saveAgentBtn.textContent = '✅ Saved Successfully!'
          saveAgentBtn.classList.remove('bg-primary')
          saveAgentBtn.classList.add('bg-emerald-500')
          setTimeout(() => {
            saveAgentBtn.innerHTML = '💾 SAVE ALL API KEYS (Encrypted)'
            saveAgentBtn.classList.remove('bg-emerald-500')
            saveAgentBtn.classList.add('bg-primary')
          }, 2000)
        } catch (e) {
          saveAgentBtn.textContent = '❌ Save Failed'
          setTimeout(() => (saveAgentBtn.innerHTML = '💾 SAVE ALL API KEYS (Encrypted)'), 2000)
        }
      } else {
        alert('API key encryption requires the Electron app. Running in demo mode.')
      }
    })
  }

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
        alert('Connection refused: ' + (res?.error || 'Ensure TCP/IP daemon is running.'))
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
        // IPC call to launch deep research window or just alert for now since we don't have the exact launch logic yet
        alert(
          'Deep Research Widget activated. This connects to Tavily & Groq in the backend for automated large-scale querying.'
        )
      } else {
        alert('Deep Research requires Electron backend.')
      }
    })
  }

  if (btnLiveCode) {
    btnLiveCode.addEventListener('click', async () => {
      if (isElectron) {
        alert(
          'Live Coding module activated. Send a prompt via AI chat to start inline coding generation.'
        )
        // Here we might eventually load the coder UI panel explicitly
      }
    })
  }

  if (btnSmartDropzones) {
    btnSmartDropzones.addEventListener('click', () => {
      alert(
        'Smart DropZones configuration launched. You can now drag and drop files onto floating targets across your desktop.'
      )
    })
  }

  if (btnGhostControl) {
    btnGhostControl.addEventListener('click', () => {
      if (isElectron) {
        alert(
          'Ghost Control (Phantom Control) sequence initiated. You can also trigger this via Ctrl+Alt+Space. Proceed with high caution.'
        )
      } else {
        alert('Ghost Control requires Native OS access.')
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
  if (scanFaceBtn) {
    scanFaceBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          const result = await ipc.invoke('biometric-scan')
          const biometricStatus = document.getElementById('biometric-status')
          if (biometricStatus) {
            biometricStatus.textContent = result ? 'Face detected and scanned' : 'No face detected'
            biometricStatus.className = result
              ? 'text-emerald-500 text-sm'
              : 'text-rose-500 text-sm'
          }
        } catch (err) {
          console.error('Face scan failed:', err)
        }
      }
    })
  }

  if (enrollFaceBtn) {
    enrollFaceBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          const result = await ipc.invoke('biometric-enroll')
          const biometricStatus = document.getElementById('biometric-status')
          if (biometricStatus) {
            biometricStatus.textContent = result
              ? 'Face enrolled successfully'
              : 'Enrollment failed'
            biometricStatus.className = result
              ? 'text-emerald-500 text-sm'
              : 'text-rose-500 text-sm'
          }
        } catch (err) {
          console.error('Face enrollment failed:', err)
        }
      }
    })
  }

  if (testRecognitionBtn) {
    testRecognitionBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          const result = await ipc.invoke('biometric-test')
          const biometricStatus = document.getElementById('biometric-status')
          if (biometricStatus) {
            biometricStatus.textContent = result ? 'Recognition successful' : 'Recognition failed'
            biometricStatus.className = result
              ? 'text-emerald-500 text-sm'
              : 'text-rose-500 text-sm'
          }
        } catch (err) {
          console.error('Recognition test failed:', err)
        }
      }
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
  if (clearAlertsBtn) {
    clearAlertsBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          await ipc.invoke('alerts-clear')
          const alertsList = document.getElementById('alerts-list')
          if (alertsList) {
            alertsList.innerHTML =
              '<div class="p-6 text-center opacity-50"><p class="text-sm">No alerts</p></div>'
          }
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
          alert(success ? 'Data exported successfully' : 'Export failed')
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
        const name = item.dataset.name.toLowerCase()
        item.style.display = name.includes(term) ? '' : 'none'
      })
    })
  }

  // Phone Link Tab
  if (connectPhoneBtn) {
    connectPhoneBtn.addEventListener('click', async () => {
      const ip = adbIp.value.trim()
      const port = adbPort.value.trim() || '5555'
      if (!ip) return

      if (isElectron) {
        try {
          const success = await ipc.invoke('adb-connect', { ip, port })
          alert(success ? 'Phone connected successfully' : 'Connection failed')
        } catch (err) {
          console.error('ADB connect failed:', err)
        }
      }
    })
  }

  if (phoneHomeBtn) {
    phoneHomeBtn.addEventListener('click', async () => {
      if (isElectron) {
        try {
          await ipc.invoke('adb-action', { action: 'home' })
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
          await ipc.invoke('adb-action', { action: 'back' })
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
          await ipc.invoke('adb-action', { action: 'recent' })
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
          await ipc.invoke('adb-action', { action: 'power' })
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
          const screenshot = await ipc.invoke('adb-screenshot')
          if (screenshot) {
            const img = document.createElement('img')
            img.src = screenshot
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

  // Settings Tab
  if (saveKeysBtn) {
    saveKeysBtn.addEventListener('click', async () => {
      const config = {
        gemini: geminiKey.value.trim(),
        groq: groqKey.value.trim(),
        hf: hfKey.value.trim(),
        tavily: tavilyKey.value.trim()
      }

      if (isElectron) {
        try {
          await ipc.invoke('settings-save-keys', config)
          saveKeysBtn.textContent = '✅ Saved!'
          setTimeout(() => {
            saveKeysBtn.textContent = '💾 Save API Keys'
          }, 2000)
        } catch (err) {
          console.error('Save keys failed:', err)
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
})()
