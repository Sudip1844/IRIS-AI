// UI Utilities (Toast, Theme, etc)
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
    error: 'bg-rose-500/10 border-rose-500/20 text-rose-500',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-500'
  };
  
  toast.className = `px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg transform transition-all duration-300 translate-y-10 opacity-0 flex items-center gap-2 ${colors[type] || colors.info}`;
  
  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>'
  };
  
  toast.innerHTML = `${icons[type] || icons.info} <span class="text-sm font-medium">${message}</span>`;
  
  container.appendChild(toast);
  
  requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
  
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

window.initTheme = function() {
  const isDarkMode = localStorage.getItem('theme') === 'dark';
  const themeToggle = document.getElementById('theme-toggle');
  const iconSun = document.getElementById('icon-sun');
  const iconMoon = document.getElementById('icon-moon');
  
  if (isDarkMode) {
    document.documentElement.classList.add('dark');
    if (iconSun && iconMoon) {
      iconSun.style.display = 'none';
      iconMoon.style.display = 'block';
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      const isDark = document.documentElement.classList.contains('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      if (iconSun && iconMoon) {
        iconSun.style.display = isDark ? 'none' : 'block';
        iconMoon.style.display = isDark ? 'block' : 'none';
      }
    });
  }
}

// Call on load
document.addEventListener('DOMContentLoaded', window.initTheme);
