# GitHub Repositories Used in MJ-AI

This document outlines all the major open-source GitHub repositories that influenced, inspired, or were directly integrated into the core architecture of **MJ-AI**.

### 1. PinchTab / Browser-use
* **GitHub Link:** Original references to `PinchTab` and `browser-use/browser-use`
* **What it's used for:** Powers the **Browser Engine**. It enables the AI to take control of Chromium, navigate pages, fill forms, click buttons, and extract DOM snapshots entirely autonomously.
* **Where it's located:** `src/main/logic/browser-engine.ts`

### 2. Claude Agent Teams
* **GitHub Link:** Reference to `claude_agent_teams` concepts
* **What it's used for:** Powers the **Multi-Agent Orchestrator** and **Agent Inbox**. It allows the creation of dynamic AI agent teams, breaking down complex user prompts into parallel sub-tasks, maintaining a Kanban-style task board, and allowing agents to message each other asynchronously.
* **Where it's located:** `src/main/agents/agent-orchestrator.ts`

### 3. Mem0 (mem0ai/mem0)
* **GitHub Link:** [mem0ai/mem0](https://github.com/mem0ai/mem0)
* **What it's used for:** Powers the **Unified & Semantic Memory** system. It provides the architecture for namespaced memory (global vs agent-specific) and intelligent semantic retrieval. Instead of simple keyword matching, it uses TF-IDF similarity to fetch relevant context based on meaning and applies importance decay.
* **Where it's located:** `src/main/logic/permanent-memory.ts` and `src/main/agents/semantic-memory.ts`

### 4. GPT-Runner (nicepkg/gpt-runner)
* **GitHub Link:** [nicepkg/gpt-runner](https://github.com/nicepkg/gpt-runner)
* **What it's used for:** Powers the **Skill Library**. This provides a modular framework for AI tools, allowing the agents to execute built-in skills (like web searches, translations, file reading) or chain them together into complex automated pipelines.
* **Where it's located:** `src/main/agents/skill-library.ts`

### 5. Anthropic Computer Use Demo
* **GitHub Link:** [anthropic-quickstarts/computer-use-demo](https://github.com/anthropic-quickstarts/computer-use-demo)
* **What it's used for:** Powers the **Vision Engine**. It enables the AI to visually analyze raw desktop screenshots and browser pages. It extracts descriptions of what is on-screen and identifies exact X/Y coordinates for clickable UI elements without needing DOM access.
* **Where it's located:** `src/main/agents/vision-engine.ts`

### 6. LangGraph (langchain-ai/langgraph)
* **GitHub Link:** [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph)
* **What it's used for:** Powers the **Stateful Agent Graphs**. It provides the engine for creating highly complex, non-linear AI workflows containing conditional branching, parallel processing lanes, loops, and state checkpoints.
* **Where it's located:** `src/main/agents/agent-graph.ts`

### 7. AutoGen (microsoft/autogen)
* **GitHub Link:** [microsoft/autogen](https://github.com/microsoft/autogen)
* **What it's used for:** Powers **Agent Debate & Consensus**. It allows two or more AI agents to argue differing viewpoints to find optimal solutions, critique each other's work in reviewer-loops, and vote on the best approach before finalizing a task.
* **Where it's located:** `src/main/agents/agent-debate.ts`

---

## 🚀 Phase 2 Global Skill Integrations

The following repositories were integrated into MJ-AI during Phase 2 (Global Skill Expansion):

### 8. Camoufox Browser (jo-inc/camofox-browser)
* **GitHub Link:** [jo-inc/camofox-browser](https://github.com/jo-inc/camofox-browser)
* **What it's used for:** Replaced Puppeteer to provide native, undetectable **Stealth Browsing**. It intercepts and masks browser fingerprints to bypass Cloudflare and advanced bot detections.
* **Where it's located:** `src/main/logic/browser-engine.ts`

### 9. Ruflo Swarm Logic (ruvnet/ruflo)
* **GitHub Link:** [ruvnet/ruflo](https://github.com/ruvnet/ruflo)
* **What it's used for:** Powers the **Swarm Execution Handoff**. Instead of a rigid Top-Down hierarchy, it allows agents to instantly transfer control/state directly to other specialist agents during complex operations.
* **Where it's located:** `src/main/agents/agent-orchestrator.ts` (`executeSwarm` method)

### 10. Prompt Master (nidhinjs/prompt-master)
* **GitHub Link:** [nidhinjs/prompt-master](https://github.com/nidhinjs/prompt-master)
* **What it's used for:** Powers dynamic **Prompt Optimization**. Agents use this as a tool to auto-rewrite and refine their own secondary prompts for maximum LLM efficiency without wasting tokens.
* **Where it's located:** `src/main/agents/skill-library.ts`

### 11. Browserbase Web Skills (browserbase/skills)
* **GitHub Link:** [browserbase/skills](https://github.com/browserbase/skills)
* **What it's used for:** Advanced DOM navigation and interaction primitives, providing the agents with a standardized way to read and interact with complex web pages reliably.
* **Where it's located:** `src/main/agents/skill-library.ts`

### 12. Trading Agents Framework (TauricResearch/TradingAgents)
* **GitHub Link:** [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents)
* **What it's used for:** Implemented as a highly specialized **Multi-Agent Analysis Team**. It separates data processing into distinct agent roles (Sentiment Analyst, Technical Analyst, Risk Manager).
* **Where it's located:** `src/main/agents/trading-team.ts`

---

## 📁 Globally Saved Repositories (Not Directly Coded in MJ-AI)

The following 4 repositories were **NOT** hardcoded directly into the MJ-AI codebase. However, they are NOT discarded! Instead, they were successfully registered into **Antigravity's Global MCP Persistent Memory** during Phase 1. We will use their logic on-demand. Here is why they weren't coded directly into MJ-AI:

### 1. Scrapling (D4Vinci/Scrapling)
* **Why it wasn't added directly:** It is a highly effective undetectable scraper, but it is written entirely in **Python**. Since MJ-AI is a strict Node.js/TypeScript application, we couldn't merge the Python code. 
* **Alternative Used:** We achieved the exact same stealth capabilities natively in TypeScript by integrating `camoufox-js` instead.

### 2. Auto-Browser (LvcidPsyche/auto-browser)
* **Why it wasn't added directly:** Similar to Scrapling, this is a **Python**-based Playwright framework. The language barrier meant its raw code wasn't compatible. 
* **Alternative Used:** We mapped its brilliant conceptual DOM logic directly into our TypeScript `browser-engine.ts`.

### 3. jCode (1jehuang/jcode)
* **Why it wasn't added directly:** This is an AI coding toolkit. MJ-AI already has a dedicated `mj-coder.ts` engine for local project work. Integrating a massive redundant coding framework wasn't necessary. It is saved in the global knowledge base for future conceptual reference.

### 4. Agency Agents (msitarzewski/agency-agents)
* **Why it wasn't added directly:** This repository contains hundreds of specific AI agent personas/prompts. Instead of bloating the MJ-AI source code with unused text files, we saved these personas in Antigravity's permanent memory. Now, whenever MJ-AI needs a specific persona, Antigravity can dynamically generate it!
