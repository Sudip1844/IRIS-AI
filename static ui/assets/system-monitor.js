(() => {
  const ipc = window.electron && window.electron.ipcRenderer ? window.electron.ipcRenderer : null;
  const isElectron = !!ipc;

  let cpuChart, ramChart;
  let statsInterval = null;
  let processInterval = null;

  // DOM Refs
  const cpuValue = document.getElementById('cpu-value');
  const cpuBar = document.getElementById('cpu-bar');
  const ramValue = document.getElementById('ram-value');
  const ramBar = document.getElementById('ram-bar');
  const ramUsed = document.getElementById('ram-used');

  function initCharts() {
    const cpuCtx = document.getElementById('cpu-chart')?.getContext('2d');
    const ramCtx = document.getElementById('ram-chart')?.getContext('2d');

    if (!cpuCtx || !ramCtx || typeof Chart === 'undefined') return;

    Chart.defaults.color = 'rgba(255, 255, 255, 0.5)';
    Chart.defaults.font.family = 'Inter, sans-serif';

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
    };

    cpuChart = new Chart(cpuCtx, {
      type: 'line',
      data: {
        labels: Array(20).fill(''),
        datasets: [{
          data: Array(20).fill(0),
          borderColor: '#3b82f6',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          backgroundColor: 'rgba(59, 130, 246, 0.1)'
        }]
      },
      options: commonOptions
    });

    ramChart = new Chart(ramCtx, {
      type: 'line',
      data: {
        labels: Array(20).fill(''),
        datasets: [{
          data: Array(20).fill(0),
          borderColor: '#f43f5e',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          backgroundColor: 'rgba(244, 63, 94, 0.1)'
        }]
      },
      options: commonOptions
    });
  }

  async function updateStats() {
    if (isElectron) {
      try {
        const info = await ipc.invoke('get-system-stats');
        if (info) {
          if (info.cpu !== undefined) {
            const cpuVal = parseFloat(info.cpu);
            const cpuStr = Math.round(cpuVal);
            if (cpuValue) {
              cpuValue.textContent = cpuStr + '%';
              if (cpuBar) cpuBar.style.width = cpuStr + '%';
            }
            if (cpuChart) {
              cpuChart.data.datasets[0].data.shift();
              cpuChart.data.datasets[0].data.push(cpuVal);
              cpuChart.update();
            }
          }
          if (info.memory !== undefined) {
            const ramVal = parseFloat(info.memory.usedPercentage);
            if (ramValue) {
              ramValue.textContent = Math.round(ramVal) + '%';
              if (ramBar) ramBar.style.width = Math.round(ramVal) + '%';
            }
            if (ramUsed) ramUsed.textContent = info.memory.used + ' USED / ' + info.memory.free + ' FREE';
            const ramTotal = document.getElementById('ram-total');
            if (ramTotal) ramTotal.textContent = info.memory.total;

            if (ramChart) {
              ramChart.data.datasets[0].data.shift();
              ramChart.data.datasets[0].data.push(ramVal);
              ramChart.update();
            }

            const healthMemory = document.getElementById('health-memory');
            if (healthMemory) {
              const pct = parseFloat(info.memory.usedPercentage);
              if (pct > 85) {
                healthMemory.textContent = `⚠️ Memory usage is critical at ${pct}%! Close unused apps.`;
              } else if (pct > 70) {
                healthMemory.textContent = `Memory usage is at ${pct}%. Consider closing background tasks.`;
              } else {
                healthMemory.textContent = `Memory usage is healthy at ${pct}%.`;
              }
            }
          }

          if (info.os) {
            const healthOs = document.getElementById('health-os');
            if (healthOs) healthOs.textContent = info.os.type || 'Windows';
          }
        }
      } catch (err) {
        console.error('Failed to get stats:', err);
      }
    }
  }

  const escapeHtml = (unsafe) => {
    return (unsafe || '').replace(/[&<"'>]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]
    })
  }

  async function updateProcesses() {
    if (!isElectron) return;

    try {
      const apps = await ipc.invoke('get-installed-apps');
      const appsGrid = document.getElementById('apps-grid');
      if (apps && apps.length > 0 && appsGrid) {
        const stringToColor = (str) => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
          return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
        };

        appsGrid.innerHTML = apps.map((a) => {
          const letter = (a.name || 'A').charAt(0).toUpperCase();
          const color = stringToColor(a.name);
          return `
            <div class="app-item p-3 md:p-4 rounded-xl md:rounded-2xl bg-card border border-border flex items-center justify-between hover:border-primary/30 transition-colors group" data-name="${escapeHtml(a.name)}">
                <div class="flex items-center gap-2 md:gap-3 min-w-0">
                    ${a.icon ? `<img src="${a.icon}" class="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl object-contain shadow-sm" />` : `
                    <div class="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm font-bold text-lg md:text-xl" style="background-color: ${color}">
                        ${letter}
                    </div>`}
                    <span class="font-bold text-xs md:text-sm truncate">${escapeHtml(a.name)}</span>
                </div>
                <button class="app-perm-btn px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-widest transition-all bg-emerald-500/10 text-emerald-500">Allowed</button>
            </div>`;
        }).join('');
      }
    } catch (err) {}

    try {
      const procs = await ipc.invoke('get-running-processes');
      const processContainer = document.getElementById('process-list-container');
      if (processContainer && procs && procs.length > 0) {
        processContainer.innerHTML = `
          <div class="grid grid-cols-4 text-[8px] md:text-[10px] uppercase tracking-widest font-bold opacity-30 px-2 mb-2 sticky top-0 bg-card z-10 pb-2">
              <span>Process</span><span>PID</span><span>CPU (sec)</span><span>Memory</span>
          </div>
          <div style="max-height: 400px; overflow-y: auto; scrollbar-width: thin;" class="space-y-0.5 pr-1">
              ${procs.map((p) => `
              <div class="grid grid-cols-4 py-1.5 md:py-2 px-2 rounded-lg transition-colors text-[10px] md:text-sm hover:bg-accent items-center">
                  <span class="font-bold truncate text-xs">${escapeHtml(p.Name || '')}</span>
                  <span class="opacity-50 text-[10px]">${p.Id || ''}</span>
                  <span class="text-blue-500 font-medium text-[10px]">${p.CpuSec || 0}s</span>
                  <span class="truncate font-medium text-[10px] ${(p.MemMB || 0) > 500 ? 'text-rose-500' : 'text-emerald-500'}">${p.MemMB || 0} MB</span>
              </div>
              `).join('')}
          </div>`;
      }
    } catch (err) {}
  }

  window.SystemMonitor = {
    init: () => setTimeout(initCharts, 1000),
    startPolling: () => {
      updateStats();
      updateProcesses();
      if (statsInterval) clearInterval(statsInterval);
      if (processInterval) clearInterval(processInterval);
      statsInterval = setInterval(updateStats, 3000);
      processInterval = setInterval(updateProcesses, 10000);
    },
    stopPolling: () => {
      if (statsInterval) clearInterval(statsInterval);
      if (processInterval) clearInterval(processInterval);
    },
    updateNow: () => { updateStats(); updateProcesses(); }
  };
})();
