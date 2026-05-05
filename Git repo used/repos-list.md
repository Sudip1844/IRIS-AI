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
