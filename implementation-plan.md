# IRIS-AI Implementation Plan

## Goal

Create a clear, approved project plan for the remaining AI provider and platform work, aligned with the user-provided priority structure and current progress.

---

## Phase 1: Core AI Provider Integration ✅

### 1. OpenAI Provider Add ✅

- GPT-4 integration
- API key handling
- Provider registry entry
- Chat routing and fallback logic

### 2. Anthropic / Claude Provider Add ✅

- Claude API integration
- Large context support
- Provider selection UI
- Chat routing support

---

## Phase 2: Chat State and Persistence ✅

### 3. Chat History Persistence ✅

- Add local persistence using LanceDB or equivalent
- Save conversation sessions per provider
- Load previous conversations on startup
- Preserve history across provider switches

---

## Phase 3: Security and Key Vault ✅

### 4. Security Vault Fix ✅

- Dual file reconciliation for sensitive data
- Proper encryption for API keys and secrets
- Secure provider credential handling
- Access control for vault operations

---

## Phase 4: Robust Error Handling ✅

### 5. Comprehensive Error Handling ✅

- Standardize error types across providers
- Map provider-specific errors to common UI behavior
- Add retry logic for transient failures
- Centralized logging for AI request failures
- Clear UI error messages

---

## Phase 5: Privacy and System Protection ✅

### 6. Fix Privacy Tab Handlers ✅

- Ensure privacy tab controls work correctly
- Implement system scan functionality
- Protect stored data and settings

### 7. Biometric System Fix ✅

- Real camera integration for biometric flows
- Liveness detection support
- Secure biometric data handling

---

## Phase 6: TypeScript Quality and Configuration ✅

### 8. TypeScript Strict Mode Enable ✅

- Enable `strict` mode in TypeScript config
- Fix type errors across provider handlers
- Ensure correct type definitions for AI services

### 9. Config Management System ✅

- Build a configurable model selection system
- Provider-specific threshold and setting controls
- Persist configuration in app settings
- Expose config options in UI

---

## Phase 7: Test Coverage and Reliability ✅

### 10. Unit Tests Add ✅

- Setup Jest or preferred test runner
- Add integration tests for provider handlers
- Add persistence and vault tests
- Aim for at least 70% coverage

---

## Phase 8: Future / Nice-to-Have Enhancements 🚀

- Visualizer audio streaming
- Advanced workflow features
- Dependency updates and cleanup
- Start with active audio visualizer + speech animation

---

## Notes

- The priority order is:
  1. OpenAI + Anthropic provider support
  2. Chat history persistence
  3. Security vault
  4. Error handling
  5. Privacy and biometric fixes
  6. TypeScript strictness + config system
  7. Unit tests
- Existing older work should be validated before adding new provider features.
- This plan is meant to be used as a working roadmap, not a task tracker file.
