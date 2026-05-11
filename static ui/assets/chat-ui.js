(() => {
  const ipc = window.electron && window.electron.ipcRenderer ? window.electron.ipcRenderer : null;
  const isElectron = !!ipc;

  // ─── Input Mode Tracking: 'text' or 'voice' ───
  // Determines whether TTS (speakAndAnimate) should fire for responses.
  // Voice mode: user spoke via mic → response should be spoken aloud.
  // Text mode: user typed → response should be text-only (no TTS).
  window.__mj_inputMode = window.__mj_inputMode || 'text';

  // DOM Refs
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const chatMessages = document.getElementById('chat-messages');
  const previewImg = document.getElementById('preview-img');
  const imagePreview = document.getElementById('image-preview');
  const fileInput = document.getElementById('file-input');
  const attachBtn = document.getElementById('attach-btn');
  const removeImage = document.getElementById('remove-image');

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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

    const parsedContent = typeof marked !== 'undefined' ? marked.parse(text) : '<p>' + escapeHtml(text) + '</p>';

    wrapper.innerHTML =
      '<div class="flex items-center gap-2 px-2">' + headerHTML + '</div>' +
      '<div class="relative group max-w-[90%] md:max-w-[85%] rounded-2xl p-3 md:p-4 text-xs md:text-sm leading-relaxed shadow-sm ' +
      bubbleClass + '" style="user-select: text; -webkit-user-select: text;">' +
      '<div class="prose prose-sm max-w-none">' + parsedContent + '</div>' +
      '<button class="copy-btn absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" title="Copy Message">' +
      '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg></button></div>';

    const copyBtn = wrapper.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.innerHTML = '<svg class="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
          setTimeout(() => {
            copyBtn.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>';
          }, 2000);
        });
      });
    }

    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function speakAndAnimate(text) {
    if (!window.speechSynthesis) return;
    const cleanText = text.replace(/[*_#]/g, '').replace(/```[\s\S]*?```/g, 'Code block omitted.');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const mjVoice = voices.find((v) => v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Google UK English Female')) || voices[0];
    if (mjVoice) utterance.voice = mjVoice;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function renderChatHistory() {
    const list = document.getElementById('chat-history-list');
    if (!list) return;
    let history = [];
    try { history = JSON.parse(localStorage.getItem('mj_chat_history') || '[]'); } catch (e) {}

    if (history.length === 0) {
      list.innerHTML = '<button class="text-left text-xs p-2 rounded-lg hover:bg-accent truncate w-full text-muted-foreground opacity-50">No history available</button>';
      return;
    }

    list.innerHTML = history.slice().reverse().map((h) => `
      <button class="text-left text-xs p-2 rounded-lg hover:bg-accent truncate w-full text-muted-foreground transition-colors group relative" title="${escapeHtml(h.user)}">
        <span class="font-semibold text-foreground block truncate">${escapeHtml(h.user)}</span>
        <span class="opacity-50 text-[10px] truncate block">${escapeHtml(h.ai).substring(0, 40)}...</span>
      </button>`).join('');
  }

  function saveChatHistory(userText, aiReply) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem('mj_chat_history') || '[]'); } catch (e) {}
    history.push({ user: userText, ai: aiReply, time: new Date().toISOString() });
    if (history.length > 50) history.shift();
    localStorage.setItem('mj_chat_history', JSON.stringify(history));
    renderChatHistory();
  }

  /**
   * Speak response aloud ONLY if the current input came from voice mode.
   * Text mode: no TTS. Voice mode: TTS enabled.
   * Resets to text mode after each response.
   */
  function speakIfVoiceMode(text) {
    if (window.__mj_inputMode === 'voice') {
      speakAndAnimate(text);
    }
    // Always reset to text mode after processing a response
    window.__mj_inputMode = 'text';
  }

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text && !previewImg.src) return;

    if (!window.isPowerOn) {
      appendMessage('error', 'MJ is currently OFF. Please start the core first.');
      chatInput.value = '';
      sendBtn.disabled = true;
      return;
    }

    if (text) appendMessage('user', text);
    chatInput.value = '';
    sendBtn.disabled = true;

    const thinkingEl = document.createElement('div');
    thinkingEl.className = 'flex items-center gap-2 text-rose-500 px-4 thinking-indicator';
    thinkingEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-bounce"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg><span class="text-xs font-medium animate-pulse">MJ is thinking...</span>';
    chatMessages.appendChild(thinkingEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    let replyText = 'No response.';
    const lowerText = text ? text.toLowerCase() : '';

    if (isElectron && lowerText.startsWith('play ') && lowerText.includes(' on spotify')) {
      const songName = lowerText.replace('play ', '').replace(' on spotify', '').trim();
      try {
        const result = await ipc.invoke('play-spotify-music', songName);
        thinkingEl.remove();
        appendMessage('mj', result);
        speakIfVoiceMode(result);
        saveChatHistory(text, result);
      } catch (err) {
        thinkingEl.remove();
        appendMessage('error', 'Backend error: ' + err.message);
      }
      return;
    }

    if (isElectron) {
      try {
        // Send image if attached
        let imageArray = [];
        if (previewImg.src && previewImg.src.startsWith('data:image')) {
           imageArray.push(previewImg.src);
           appendMessage('user', '[Attached Image]');
           previewImg.src = '';
           imagePreview.style.display = 'none';
        }
        
        let result;
        if (imageArray.length > 0) {
            result = await ipc.invoke('chat-with-ai-vision', { text: text || 'Describe this image', images: imageArray });
        } else {
            result = await ipc.invoke('chat-with-ai', text);
        }

        replyText = result || 'No response.';
        thinkingEl.remove();
        if (typeof replyText === 'string' && /(^ERROR:|\bError:|\bFailed\b|\bfailed\b)/.test(replyText)) {
          appendMessage('error', replyText);
        } else {
          appendMessage('mj', replyText);
          speakIfVoiceMode(replyText);
        }
      } catch (err) {
        thinkingEl.remove();
        replyText = 'Backend error: ' + (err?.message || String(err));
        appendMessage('error', replyText);
      }
    } else {
      await new Promise((r) => setTimeout(r, 1500));
      thinkingEl.remove();
      replyText = 'I received: "' + text + '". Connect to Electron backend for full AI functionality.';
      appendMessage('mj', replyText);
      speakIfVoiceMode(replyText);
    }

    saveChatHistory(text || 'Image Upload', replyText);
  }

  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      if (window.showToast) window.showToast('Please upload an image file.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      previewImg.src = reader.result;
      imagePreview.style.display = 'flex';
      sendBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  // Event Listeners
  document.addEventListener('DOMContentLoaded', () => {
    if (chatInput) {
      chatInput.addEventListener('input', () => { sendBtn.disabled = !chatInput.value.trim() && !previewImg.src; });
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      });
      chatInput.addEventListener('dragover', (e) => { e.preventDefault(); chatInput.classList.add('border-primary', 'bg-primary/5'); });
      chatInput.addEventListener('dragleave', (e) => { e.preventDefault(); chatInput.classList.remove('border-primary', 'bg-primary/5'); });
      chatInput.addEventListener('drop', (e) => {
        e.preventDefault();
        chatInput.classList.remove('border-primary', 'bg-primary/5');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleImageFile(e.dataTransfer.files[0]);
      });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (attachBtn) attachBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleImageFile(e.target.files[0]); });
    if (removeImage) {
      removeImage.addEventListener('click', () => {
        previewImg.src = '';
        imagePreview.style.display = 'none';
        fileInput.value = '';
        sendBtn.disabled = !chatInput.value.trim();
      });
    }

    const clearChatHistoryBtn = document.getElementById('clear-chat-history');
    if (clearChatHistoryBtn) {
      clearChatHistoryBtn.addEventListener('click', () => {
        if (confirm('Clear all chat history?')) {
          localStorage.removeItem('mj_chat_history');
          renderChatHistory();
        }
      });
    }

    renderChatHistory();

    // Expose global methods
    window.ChatUI = {
      appendMessage,
      sendMessage,
      speakAndAnimate
    };
    
    // IPC listeners
    if (isElectron) {
      ipc.on('chat-reply', (event, data) => {
        appendMessage('mj', data);
        speakIfVoiceMode(data);
      });
      ipc.on('chat-error', (event, data) => appendMessage('error', data));
    }
  });

})();
