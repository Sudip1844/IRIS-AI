<div align="center">

# MJ Assistant

## The Autonomous Neural OS Agent

**A local-first neural execution system that turns intent into real OS actions.**

---

</div>

# 📑 Table of Contents

- [⚡ Overview](#-overview)
- [✨ Core Features](#-core-features)
- [🏗️ Architecture](#️-architecture)
- [💻 Tech Stack](#-tech-stack)
- [🔐 Security](#-security)
- [🚀 Installation & Setup](#-installation--setup)
- [📁 Project Structure](#-project-structure)
- [🧠 Development Philosophy](#-development-philosophy)
- [🧩 Extending MJ Assistant](#-extending-mj-assistant)
- [🧠 Roadmap](#-roadmap)
- [⚠️ Disclaimer](#️-disclaimer)
- [👨‍💻 Architect](#-architect)

---

# ⚡ Overview

MJ Assistant is not a chatbot.

It is a **local-first AI Operating System layer** that executes real-world actions across your system, applications, and devices.

> Speak your command. MJ executes it.

---

# ✨ Core Features & System Capabilities

### 📂 System & File Management

- 🖥️ **Open App:** Native application lifecycle control.
- 🛑 **Close App:** Instant process termination commands.
- 🗂️ **Read Directory:** Local folder scanning & indexing.
- 📁 **Create Folder:** Instant directory structure generation.
- 📄 **Read File:** Deep text & code extraction.
- 📝 **Write File:** Autonomous disk write access.
- 🔄 **Manage File:** Copy, move, and delete control.
- 🚀 **Open File:** Native OS application launcher.
- 🗃️ **Smart Drop Zones:** Viral, autonomous folder sorting.

### 🧠 Vector Search & Local Knowledge

- 🔍 **Index Folder:** Semantic LanceDB directory ingestion.
- 🔎 **Smart File Search:** Vector-based local file retrieval.
- 🖼️ **Read Gallery:** Local image cache scanning.
- 👁️ **Analyze Photo:** Direct multimodal vision processing.

### 💻 Developer & Terminal Tools

- ⌨️ **Run Terminal:** Native shell & CLI execution.
- 🛠️ **Open Project:** Instant IDE workspace loading.
- ⚙️ **Activate Protocol:** Context-aware coding mode switch.
- 🏗️ **Build File:** Writing code directly to disk.
- 🤖 **Execute Sequence:** JSON-based macro automation runs.
- ▶️ **Execute Macro:** Named workflow sequence triggering.
- 🕳️ **Deploy Wormhole:** Expose localhost to public internet.
- 🛑 **Close Wormhole:** Terminate public localhost tunnels.

### 🎯 Desktop UI, Vision & Automation

- 🪟 **Teleport Windows:** Dynamic desktop window management.
- 🧩 **Create Widget:** Spawn live floating desktop components.
- ❌ **Close Widgets:** Clear active floating overlays.
- 🖱️ **Click on Screen:** AI-driven exact coordinate targeting.
- 📜 **Scroll Screen:** Autonomous up/down page navigation.
- ⚡ **Press Shortcut:** Global keyboard hotkey injection.
- 👻 **Phantom Typer:** Global inline clipboard injection.
- ✂️ **Screen Peeler (OCR):** Instant UI-to-code visual extraction.
- ⌨️ **Ghost Coder:** Inline IDE generation (`Ctrl+Alt+Space`).
- 🔊 **Set Volume:** Master audio level control.
- 📸 **Take Screenshot:** Instant visual context capture.

### 💾 Memory & Information

- 🧠 **Save Core Memory:** Deep persistent identity tracking.
- 📥 **Retrieve Memory:** Instant past context recall.
- 📝 **Save Note:** Local markdown note generation.
- 📖 **Read Notes:** Instant saved plan retrieval.
- 📧 **Read Emails:** Gmail inbox scraping & summarization.

### 🌐 Web, Media & Financials

- 🔍 **Google Search:** Live internet data retrieval.
- 🌤️ **Get Weather:** Real-time atmospheric condition checks.
- 🗺️ **Open Map:** Interactive dark-mode map loading.
- 🚗 **Get Navigation:** Real-time routing and directions.
- 🎵 **Play Spotify:** Instant music & playlist execution.
- 📈 **Stock Price:** Real-time financial ticker tracking.
- 📊 **Compare Stocks:** Dual-ticker fundamental market analysis.
- 🕷️ **Hack Live Website:** Viral visual DOM manipulation.
- 🎨 **Build Animated Web:** Agentic Tailwind & GSAP generation.
- 🖼️ **Generate Image:** High-fidelity multimodal media generation.

### 💬 Communications

- 📲 **Send WhatsApp:** Instant automated message dispatch.
- 🕒 **Schedule WhatsApp:** Cron-based delayed message automation.
- 📧 **Draft Email:** Autonomous message composition.
- 🚀 **Send Email:** Action-oriented direct dispatch.

### 📱 Mobile Telekinesis (Phone Link)

- 🔔 **Mobile Notifications:** Read texts from connected phone.
- 🔋 **Mobile Info:** Battery & hardware telemetry tracking.
- 📤 **Push File to Mobile:** Seamless PC-to-phone transfers.
- 📥 **Pull File from Mobile:** Instant phone-to-PC fetching.
- 📱 **Open Mobile App:** Remote Android application launching.
- 🛑 **Close Mobile App:** Remote Android process killing.
- 👆 **Tap Mobile Screen:** Remote coordinate touch execution.
- 📜 **Swipe Mobile Screen:** Remote directional scrolling control.
- ⚙️ **Toggle Hardware:** Remote Wi-Fi/Bluetooth/Flashlight switching.

### 🕵️ Autonomous Research & Deep RAG

- 🕸️ **Deep Research:** Autonomous web crawling.
- 📓 **Read Notion Reports:** Deep sync with Notion databases.
- 📚 **Ingest Codebase:** Deep local project Vector embedding.
- 🔮 **Consult Oracle:** Deep local codebase RAG queries.

### 🔐 Security & OS Vault

- 🔒 **Lock System Vault:** Standard PIN OS lockdown protocol.
- 🛡️ **Biometric Encryption:** Multi-face recognition OS lockdown.

---

# 🏗️ Architecture

### Frontend

- HTML5 + Vanilla JS + Tailwind CSS
- Handles UI, commands, active vision overlays, phone link stats

### Backend

- Electron (Node.js) main process
- Full system access (files, automation, sockets, ADB)

### IPC Bridge

- Secure bridge connecting Custom MJ UI directly to system functions using Context Isolation (`ipcRenderer.invoke`).

---

# 💻 Tech Stack

MJ Assistant is forged using a high-performance stack combining web technologies with deep native OS access and state-of-the-art AI models.

### 🖥️ Core Desktop & UI Framework

- **Electron & Vite:** High-performance desktop compilation and split-process architecture.
- **Frontend UI:** Vanilla JavaScript, HTML5, Custom CSS animations.
- **Tailwind CSS v4:** Utility-first styling engine.
- **React 19:** Modern React with concurrent features (used in legacy UI).
- **Framer Motion:** Advanced animations and transitions.
- **GSAP:** High-performance animation library.
- **Three.js & @react-three/fiber:** 3D graphics and visualizations.
- **Zustand:** Lightweight state management.

### 🧠 AI, RAG & Machine Learning

- **Google Gemini AI:** Core reasoning and generative engine (`@google/genai`).
- **Groq SDK:** Ultra-fast, low-latency inference routing.
- **Hugging Face & Xenova:** Local model inference and transformers.
- **Face-API.js:** Local biometric facial recognition.
- **LanceDB (VectorDB):** Embedded local vector database for deep codebase RAG and memory storage.
- **Tesseract.js:** OCR for screen text extraction.
- **PDF-Parse & Mammoth:** Document parsing for PDFs and Word files.

### ⚙️ OS Control & Automation Engine

- **ADB Integration:** Real-time mobile bridging for phone telemetry.
- **Nut.js:** Deep native desktop automation (mouse, keyboard).
- **Puppeteer:** Headless browser automation with stealth plugins.
- **Node Window Manager:** Native window management.
- **Native Utilities:** File system, process management, system info.

### 🔗 Integrations & Parsing

- **Google APIs:** Gmail, Calendar, Drive integration.
- **Notion API:** Deep sync with Notion databases.
- **Tavily:** Advanced web search and research.
- **Cheerio:** HTML parsing and scraping.
- **ADB Manager:** Android device control and telemetry.
- **Web Agent:** Automated web interaction and scraping.

### ⚙️ OS Control & Automation Engine

- **ADB Integration:** Real-time mobile bridging for phone telemetry.
- **Nut.js:** Deep native desktop automation (mouse, keyboard).
- **Puppeteer:** Headless browser automation.

---

# 🔐 Security

- 100% BYOK (Bring Your Own Key) saved securely locally.
- Zero-trust architecture with high-security Ghost / Overlay prompts.
- Built-in Quarantine manager to isolate flagged code files.

---

# 🚀 Installation & Setup

### 1. Environment Setup

Copy `.env.example` to `.env` or set it up directly through the GUI Settings tab.

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Dev Server

```bash
npm run dev
```

### 4. Initialize Vault & Keys

- Open app
- Go to the **Settings** tab.
- Add your API keys securely in the dashboard section.

---

# 📁 Project Structure

```text
mj-assistant/
├── static ui/               # New Vanilla HTML/JS custom UI layer (Your Dashboard)
│   ├── index.html           # Main UI entry point
│   └── assets/              # Native scripts (app.js), css, and icons
├── build/                   # OS-specific build artifacts
├── out/                     # Compiled output ready for packaging
├── src/                     # Core application source code
│   ├── main/                # Node.js backend & hardware execution
│   └── preload/             # Context Isolation IPC Hooks
├── .env.example             # Template for API keys
└── package.json             # Project dependencies and configs
```

---

# 🧠 Development Philosophy

- Execution > Conversation
- Local-first intelligence
- Modular system design
- Real-world usability
- Maximum Desktop Integration

---

# 🧩 Extending MJ Assistant

You can:

- Add new tools inside `app.js` and bind them to the node backend.
- Connect more features into the "Phone Link" ADB system.
- Build automation modules.
- Extend UI widgets recursively.

---

## 🧠 Roadmap

- [ ] Extended Voice Input Controls
- [ ] Direct iOS Screen Mirroring
- [ ] Memory graph expansions
- [ ] Multi-agent widget clusters
- [ ] Cross-device synchronization

---

# ⚠️ Disclaimer

MJ Assistant has deep system-level execution capabilities.  
Use responsibly. The creator is not liable for misuse.

---

# 👨‍💻 Architect

**Sudip**  
AI Systems & Frontend Engineer

---

# 🟥 Final Note

**MJ Assistant is not a chatbot.** It is a **neural extension of your operating system**.

> _System Online._
