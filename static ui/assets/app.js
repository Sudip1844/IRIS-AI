// ===== MJ Control Center - Electron Bridge =====
// Connects the static HTML UI to the IRIS Electron backend via IPC.

(function() {
    'use strict';

    // --- Electron IPC Bridge ---
    // In Electron, window.electron is exposed via preload.
    // In a browser (dev preview), we fallback to demo mode.
    const ipc = (window.electron && window.electron.ipcRenderer)
        ? window.electron.ipcRenderer
        : null;

    const isElectron = !!ipc;

    // --- State ---
    let isPowerOn = false;
    let isDarkMode = false;
    let isSidebarExpanded = false;
    let statsInterval = null;

    // --- DOM refs ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const themeToggle = document.getElementById('theme-toggle');
    const iconSun = document.getElementById('icon-sun');
    const iconMoon = document.getElementById('icon-moon');
    const powerBtn = document.getElementById('power-btn');
    const coreStatus = document.getElementById('core-status');
    const voiceStatus = document.getElementById('voice-status');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const chatMessages = document.getElementById('chat-messages');
    const attachBtn = document.getElementById('attach-btn');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const removeImage = document.getElementById('remove-image');
    const appSearch = document.getElementById('app-search');

    // Monitor elements
    const cpuValue = document.getElementById('cpu-value');
    const cpuBar = document.getElementById('cpu-bar');
    const ramValue = document.getElementById('ram-value');
    const ramBar = document.getElementById('ram-bar');
    const ramUsed = document.getElementById('ram-used');
    const processCore = document.getElementById('process-core');
    const processBrain = document.getElementById('process-brain');
    const processVoice = document.getElementById('process-voice');
    const processSpinner = document.getElementById('process-spinner');

    // --- Tab Switching ---
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const tabContents = document.querySelectorAll('.tab-content');

    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.dataset.tab;
            sidebarItems.forEach(si => si.classList.remove('active'));
            item.classList.add('active');
            tabContents.forEach(tc => {
                tc.style.display = 'none';
                tc.classList.remove('active');
            });
            const target = document.getElementById('tab-' + tabId);
            if (target) {
                target.style.display = '';
                target.classList.add('active');
            }
        });
    });

    // --- Sidebar Toggle ---
    sidebarToggle.addEventListener('click', () => {
        if (window.innerWidth >= 1100) {
            isSidebarExpanded = !isSidebarExpanded;
            document.body.classList.toggle('sidebar-expanded', isSidebarExpanded);
        }
    });

    function handleResize() {
        if (window.innerWidth < 1100) {
            isSidebarExpanded = false;
            document.body.classList.remove('sidebar-expanded');
        }
    }
    window.addEventListener('resize', handleResize);
    handleResize();

    // --- Theme Toggle ---
    themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.documentElement.classList.toggle('dark', isDarkMode);
        iconSun.style.display = isDarkMode ? 'none' : '';
        iconMoon.style.display = isDarkMode ? '' : 'none';
    });

    // --- Power Button ---
    powerBtn.addEventListener('click', () => {
        isPowerOn = !isPowerOn;
        
        if (isPowerOn) {
            powerBtn.className = 'flex items-center gap-2 px-3 py-1.5 md:px-6 md:py-2.5 rounded-full font-bold text-[10px] md:text-sm transition-all active:scale-95 bg-rose-600 text-white shadow-lg shadow-rose-500/20';
            powerBtn.querySelector('span').textContent = 'STOP MJ';
            coreStatus.textContent = '● Core Active';
            coreStatus.className = 'text-[8px] md:text-sm font-bold uppercase tracking-widest truncate text-emerald-500';
            voiceStatus.textContent = 'Voice: Listening...';
            
            processCore.classList.add('process-active');
            processBrain.classList.add('process-active');
            processVoice.classList.add('process-active');
            if (processSpinner) processSpinner.classList.add('animate-spin');
            
            startStatsUpdates();
        } else {
            powerBtn.className = 'flex items-center gap-2 px-3 py-1.5 md:px-6 md:py-2.5 rounded-full font-bold text-[10px] md:text-sm transition-all active:scale-95 bg-emerald-600 text-white shadow-lg shadow-emerald-500/20';
            powerBtn.querySelector('span').textContent = 'START MJ';
            coreStatus.textContent = '○ Core Offline';
            coreStatus.className = 'text-[8px] md:text-sm font-bold uppercase tracking-widest truncate text-rose-500';
            voiceStatus.textContent = 'Voice: Standby';
            
            processCore.classList.remove('process-active');
            processBrain.classList.remove('process-active');
            processVoice.classList.remove('process-active');
            if (processSpinner) processSpinner.classList.remove('animate-spin');
            
            stopStatsUpdates();
        }
    });

    // --- Stats (real data from Electron, or simulated) ---
    function startStatsUpdates() {
        updateStats();
        statsInterval = setInterval(updateStats, 3000);
    }

    function stopStatsUpdates() {
        if (statsInterval) clearInterval(statsInterval);
        if (cpuValue) { cpuValue.textContent = '0%'; cpuBar.style.width = '0%'; }
        if (ramValue) { ramValue.textContent = '0%'; ramBar.style.width = '0%'; }
        if (ramUsed) ramUsed.textContent = '0GB';
    }

    async function updateStats() {
        if (isElectron) {
            try {
                const info = await ipc.invoke('get-system-info');
                if (info && info.cpu !== undefined) {
                    const cpu = Math.round(info.cpu);
                    if (cpuValue) { cpuValue.textContent = cpu + '%'; cpuBar.style.width = cpu + '%'; }
                }
                if (info && info.ram !== undefined) {
                    const ram = Math.round(info.ram);
                    const ramGB = ((ram / 100) * 16).toFixed(1);
                    if (ramValue) { ramValue.textContent = ram + '%'; ramBar.style.width = ram + '%'; }
                    if (ramUsed) ramUsed.textContent = ramGB + 'GB';
                }
                return;
            } catch(e) { /* fall through to simulated */ }
        }
        // Simulated stats for demo / non-Electron mode
        const cpu = Math.floor(Math.random() * 30) + 5;
        const ram = Math.floor(Math.random() * 20) + 40;
        const ramGB = ((ram / 100) * 16).toFixed(1);
        if (cpuValue) { cpuValue.textContent = cpu + '%'; cpuBar.style.width = cpu + '%'; }
        if (ramValue) { ramValue.textContent = ram + '%'; ramBar.style.width = ram + '%'; }
        if (ramUsed) ramUsed.textContent = ramGB + 'GB';
    }

    // ========= CHAT → ELECTRON IPC BRIDGE =========
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            sendBtn.disabled = !chatInput.value.trim() && !previewImg.src;
        });
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        
        if (!isPowerOn) {
            appendMessage('error', 'MJ is currently OFF. Please start the core first.');
            chatInput.value = '';
            sendBtn.disabled = true;
            return;
        }

        appendMessage('user', text);
        chatInput.value = '';
        sendBtn.disabled = true;

        // Show thinking indicator
        const thinkingEl = document.createElement('div');
        thinkingEl.className = 'flex items-center gap-2 text-rose-500 px-4 thinking-indicator';
        thinkingEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-bounce"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg><span class="text-xs font-medium animate-pulse">MJ is thinking...</span>';
        chatMessages.appendChild(thinkingEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        if (isElectron) {
            // Route the chat message through the IRIS AI backend
            try {
                // For now, we send the text to the main process
                // The GeminiLiveService in IRIS handles actual AI responses
                // This is a placeholder for the full voice-AI integration
                const result = await ipc.invoke('run-shell-command', { command: `echo "${text}"` });
                thinkingEl.remove();
                appendMessage('mj', 'Command executed. Result: ' + (result.output || 'Done'));
            } catch (err) {
                thinkingEl.remove();
                appendMessage('error', 'Backend error: ' + err.message);
            }
        } else {
            // Static demo fallback
            setTimeout(() => {
                thinkingEl.remove();
                appendMessage('mj', 'I received: "' + text + '". Connect to Electron backend for full AI functionality.');
            }, 1500);
        }
    }

    function appendMessage(role, text) {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col gap-2 ' + (role === 'user' ? 'items-end' : 'items-start');
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let headerHTML = '';
        let bubbleClass = '';
        
        if (role === 'user') {
            headerHTML = '<span class="text-[10px] opacity-50">' + time + '</span><span class="text-xs font-bold text-blue-400">You</span>';
            bubbleClass = 'bg-blue-600 text-white rounded-tr-none shadow-blue-500/10';
        } else if (role === 'mj') {
            headerHTML = '<span class="text-xs font-bold text-rose-500">MJ</span><span class="text-[10px] opacity-50">' + time + '</span>';
            bubbleClass = 'bg-card text-foreground border border-border rounded-tl-none';
        } else if (role === 'error') {
            bubbleClass = 'bg-rose-500/10 text-rose-600 border border-rose-500/20 w-full text-center';
        } else {
            bubbleClass = 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 w-full text-center italic';
        }

        wrapper.innerHTML = 
            '<div class="flex items-center gap-2 px-2">' + headerHTML + '</div>' +
            '<div class="max-w-[90%] md:max-w-[85%] rounded-2xl p-3 md:p-4 text-xs md:text-sm leading-relaxed shadow-sm ' + bubbleClass + '">' +
            '<div class="prose prose-sm max-w-none"><p>' + escapeHtml(text) + '</p></div></div>';

        chatMessages.appendChild(wrapper);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- Image Upload ---
    if (attachBtn) attachBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    previewImg.src = reader.result;
                    imagePreview.style.display = 'flex';
                    sendBtn.disabled = false;
                };
                reader.readAsDataURL(file);
            }
        });
    }
    if (removeImage) {
        removeImage.addEventListener('click', () => {
            previewImg.src = '';
            imagePreview.style.display = 'none';
            fileInput.value = '';
            sendBtn.disabled = !chatInput.value.trim();
        });
    }

    // --- App Search ---
    if (appSearch) {
        appSearch.addEventListener('input', () => {
            const term = appSearch.value.toLowerCase();
            document.querySelectorAll('.app-item').forEach(item => {
                const name = item.dataset.name.toLowerCase();
                item.style.display = name.includes(term) ? '' : 'none';
            });
        });
    }

    // --- App Permission Toggle ---
    document.querySelectorAll('.app-perm-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const isAllowed = btn.dataset.allowed === 'true';
            btn.dataset.allowed = isAllowed ? 'false' : 'true';
            if (isAllowed) {
                btn.textContent = 'Denied';
                btn.className = 'app-perm-btn px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-widest transition-all bg-rose-500/10 text-rose-500';
            } else {
                btn.textContent = 'Allowed';
                btn.className = 'app-perm-btn px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-widest transition-all bg-emerald-500/10 text-emerald-500';
            }
        });
    });

    // --- Privacy Toggle Buttons ---
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const isActive = btn.dataset.active === 'true';
            btn.dataset.active = isActive ? 'false' : 'true';
            const knob = btn.querySelector('div');
            if (isActive) {
                btn.classList.remove('bg-emerald-500');
                btn.classList.add('bg-slate-300');
                knob.classList.remove('translate-x-6');
                knob.classList.add('translate-x-0');
            } else {
                btn.classList.remove('bg-slate-300');
                btn.classList.add('bg-emerald-500');
                knob.classList.remove('translate-x-0');
                knob.classList.add('translate-x-6');
            }
        });
    });

    // --- Visualizer Selection ---
    const vizBtns = document.querySelectorAll('.viz-btn');
    const vizPreview = document.getElementById('viz-preview');

    const vizTemplates = {
        pulse: '<div class="viz-pulse relative w-12 h-12 flex items-center justify-center"><div class="absolute w-full h-full bg-primary rounded-full animate-pulse-scale"></div><div class="w-6 h-6 bg-primary rounded-full shadow-lg shadow-primary/50"></div></div>',
        wave: '<div class="viz-wave"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>',
        bars: '<div class="viz-bars"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>',
        liquid: '<div class="viz-liquid"></div>',
        aura: '<div class="viz-aura"><div class="glow"></div><div class="dot"></div></div>',
        orbit: '<div class="viz-orbit"><div class="center"></div><div class="ring"><div class="sat"></div></div><div class="ring"><div class="sat"></div></div><div class="ring"><div class="sat"></div></div></div>',
        vortex: '<div class="viz-vortex"><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="ring"></div></div>',
        cyber: '<div class="viz-cyber"><svg viewBox="0 0 100 40"><path class="line" d="M0,20 L20,20 L25,10 L35,30 L40,20 L60,20 L65,5 L75,35 L80,20 L100,20"/><path class="glow-line" d="M0,20 L20,20 L25,10 L35,30 L40,20 L60,20 L65,5 L75,35 L80,20 L100,20"/></svg></div>'
    };

    vizBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            vizBtns.forEach(b => {
                b.classList.remove('active-viz', 'bg-primary', 'text-primary-foreground', 'border-primary', 'shadow-lg', 'shadow-primary/20');
                b.classList.add('bg-card', 'border-border');
            });
            btn.classList.add('active-viz');
            btn.classList.remove('bg-card', 'border-border');

            const type = btn.dataset.viz;
            if (vizPreview && vizTemplates[type]) {
                vizPreview.innerHTML = vizTemplates[type];
            }
        });
    });

    // --- Sub Agent Input ---
    const subagentInput = document.getElementById('subagent-input');
    const subagentSend = document.getElementById('subagent-send');
    
    if (subagentInput) {
        subagentInput.addEventListener('input', () => {
            subagentSend.disabled = !subagentInput.value.trim();
        });
        subagentInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (subagentInput.value.trim()) {
                    alert('Sub Agent API integration requires backend configuration.');
                    subagentInput.value = '';
                    subagentSend.disabled = true;
                }
            }
        });
    }
    if (subagentSend) {
        subagentSend.addEventListener('click', () => {
            alert('Sub Agent API integration requires backend configuration.');
        });
    }

    // --- Scan System Button (REAL data from Electron) ---
    const scanBtn = document.getElementById('scan-btn');
    if (scanBtn) {
        scanBtn.addEventListener('click', async () => {
            scanBtn.disabled = true;
            scanBtn.classList.add('animate-pulse');
            scanBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg> Scanning...';

            if (isElectron) {
                try {
                    const apps = await ipc.invoke('get-running-apps');
                    console.log('[MJ] Running apps:', apps);
                } catch(e) { /* silent */ }
            }

            setTimeout(() => {
                scanBtn.disabled = false;
                scanBtn.classList.remove('animate-pulse');
                scanBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg> Scan System';
            }, 1500);
        });
    }

    // --- Log Electron status ---
    console.log('[MJ Control Center] Electron bridge:', isElectron ? 'CONNECTED' : 'DEMO MODE');

})();
