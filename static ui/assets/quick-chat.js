// ===== MJ Quick Chat – Electron Bridge =====
;(function () {
  'use strict'

  const ipc = window.electron && window.electron.ipcRenderer ? window.electron.ipcRenderer : null

  const isElectron = !!ipc

  // DOM
  const messages = document.getElementById('qc-messages')
  const welcome = document.getElementById('qc-welcome')
  const input = document.getElementById('qc-input')
  const sendBtn = document.getElementById('qc-send')
  const closeBtn = document.getElementById('qc-close')

  let chatHistory = []

  // ─── Close ───
  closeBtn.addEventListener('click', () => {
    if (isElectron) {
      window.close()
    }
  })

  // ─── Input ───
  input.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim()
    // Auto-resize
    input.style.height = 'auto'
    input.style.height = Math.min(input.scrollHeight, 80) + 'px'
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  })

  sendBtn.addEventListener('click', () => sendMessage())

  // ─── Send Message ───
  async function sendMessage() {
    const text = input.value.trim()
    if (!text) return

    // Hide welcome
    if (welcome) welcome.style.display = 'none'

    // Show user message
    appendMessage('user', text)
    input.value = ''
    input.style.height = 'auto'
    sendBtn.disabled = true

    // Show typing indicator
    const typingEl = appendMessage(
      'ai',
      '<div class="typing-dots"><span></span><span></span><span></span></div>'
    )

    chatHistory.push({ role: 'user', content: text })

    // Send to Electron backend
    if (isElectron) {
      try {
        const response = await ipc.invoke('chat-with-ai', text)
        const reply = response || 'Sorry, I could not process that.'
        const isError =
          typeof reply === 'string' && /(^ERROR:|\bError:|\bFailed\b|\bfailed\b)/.test(reply)
        typingEl.innerHTML = isError
          ? `<span style="color:#b91c1c;font-weight:600;line-height:1.5">${escapeHtml(reply)}</span>`
          : formatResponse(reply)
        chatHistory.push({ role: 'assistant', content: reply })
      } catch (err) {
        typingEl.innerHTML =
          '<em style="opacity:0.6">Failed to reach MJ backend. Is the core active?</em>'
      }
    } else {
      // Demo mode
      setTimeout(() => {
        typingEl.innerHTML = 'This is a demo reply. Connect to Electron for real responses!'
      }, 1200)
    }

    scrollToBottom()
  }

  // ─── Append a chat bubble ───
  function appendMessage(role, html) {
    const div = document.createElement('div')
    div.className = 'qc-msg ' + role
    div.innerHTML = html
    messages.appendChild(div)
    scrollToBottom()
    return div
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messages.scrollTop = messages.scrollHeight
    })
  }

  function formatResponse(text) {
    // Basic markdown: bold, italic, code
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(
        /`(.*?)`/g,
        '<code style="background:rgba(100,180,255,0.1);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>'
      )
      .replace(/\n/g, '<br>')
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  // Focus input on load
  input.focus()
})()
