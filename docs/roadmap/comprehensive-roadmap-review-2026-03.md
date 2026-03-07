# Crewly Comprehensive Roadmap Review & Priority Audit (2026-03)

**Status:** COMPLETED  
**Auditor:** Mia (PM, crewly-core-mia-member-1)  
**Date:** 2026-03-04  
**Reference Strategy:** OKR v2 - Customer-First (Feb 28, 2026)  
**Reference Roadmap:** Comprehensive Roadmap Q1 v1.0 (Mar 3, 2026)

---

## 1. Executive Summary

Following the strategic shift from **"Product-First"** to **"Customer-First"** (Ethan's OKR v2), I have audited the existing roadmap. The primary focus for Q1/Q2 is now **MRR and Customer Success (10 Paid Pilots)** rather than chasing competitive parity with CrewAI or OpenClaw. 

The "Live Terminal + Team Dashboard" remains our core moat. Roadmap items are now prioritized based on their contribution to **SteamFun Pilot success**, **Sales enablement (Grace)**, and **Product reliability**.

---

## 2. Updated Priority Matrix (Aligned with OKR v2)

| Priority | Feature / Task | Status | Strategic Alignment |
| :--- | :--- | :--- | :--- |
| **P0** | **SteamFun Pilot Delivery (KR1.1)** | In Progress | First revenue/case study. |
| **P0** | **`npx crewly init` (Project Scaffolding)** | Partial | Onboarding friction for Route A (Local). |
| **P0** | **MacOS Bash 3.2 Compatibility Fix** | Ongoing | Support for default macOS environments. |
| **P0** | **Task Lifecycle & Stability (Smart Delegate)** | 90% (Sam) | Critical for reliable multi-agent ops. |
| **P1** | **3-Agent Demo Flow (KR2.5)** | Missing Ops | Demonstrating the Moat (Live Terminal). |
| **P1** | **Sales Assets (/enterprise, /case, BookACall)** | In Progress | Enabling Grace (Sales) to close pilots. |
| **P1** | **Safe-Kill Abort Keywords** | Not Started | Safety and control perception for SMBs. |
| **P2** | **LLM Adapter Layer (BYOK)** | In Progress | Model flexibility (Claude/Gemini/Codex). |
| **P2** | **Daily Content Engine (Luna)** | Starting | Content daily output for lead gen. |
| **P3** | **Full MCP Protocol Parity** | In Progress | Only as requested by specific customers. |
| **P4** | **Vector Memory (RAG)** | Deferred | Only if client context requires it. |
| **P4** | **Visual Workflow Builder / Training Framework** | Deferred | Competitive parity; not customer requested. |

---

## 3. Detailed Audit Findings

### 3.1 Onboarding & "Init"
*   **Finding:** `npx crewly init` currently aliases to `onboard`. 
*   **Gap:** `onboard` focuses on global setup (tools, skills). Project-level scaffolding is too basic (folders only).
*   **Recommendation:** Enhance `init` to automatically detect project type and scaffold a suggested `team.json` and `goals.md` based on vertical templates (Education, Content Agency, etc.).

### 3.2 Task Lifecycle (The "Bug")
*   **Finding:** Sam has implemented "Smart Delegate" (v2.0) with auto-monitoring and session completion. 
*   **Validation:** `report-status` skill now includes `/task-management/complete-by-session` calls and handles Bash 3.2 compatibility (`tr` instead of `${VAR^^}`).
*   **Action:** Verify if all other skills (recall, remember, etc.) are Bash 3.2 compatible.

### 3.3 SteamFun Integration (The First P0)
*   **Finding:** Requirements gathered. Nick's prototype has some P0 admin routing bugs.
*   **Gap:** We need a "Google Workspace" skill pack that is production-ready (Drive/Slides API).
*   **Recommendation:** Elevate "Google Workspace Skill Pack" to P0 for Sam/Nick.

### 3.4 The "Moat" (Dashboard + Live Terminal)
*   **Finding:** Features are "MET" but not "SHOWCASED". 
*   **Gap:** Missing the "Ops" role and a predefined "Core Team" template to make a 3-agent demo easy to run.
*   **Recommendation:** Mia (PM) to complete "Core Team" template and "Collaboration Playbook" by W10.

---

## 4. Priority Adjustment Suggestions

1.  **Demote G-series (Gap Matrix) items**: `G6 (LLM Adapter)`, `G9 (MCP)`, and `G3 (Vector Memory)` should only be advanced when a specific Pilot (like SteamFun) requires it. Currently, they are taking too much of Sam's bandwidth.
2.  **Elevate "Service Delivery" Tools**: Prioritize features that help Mia and Grace manage client pilots (e.g., better logging, cost tracking per project, exportable reports for clients).
3.  **Stability First**: The GitHub issues #104-108 (reported by Sam) should be closed before adding "New" advanced features.

---

## 5. Status Summary of Planned Features

| Feature | Category | Status | Note |
| :--- | :--- | :--- | :--- |
| `npx crewly init` | New | **Partial** | Aliased to onboard; needs project-level scaffolding. |
| Task Lifecycle Fix | Fix | **90%** | Smart Delegate v2.0 implemented; testing in wild. |
| Safe-Kill Keywords | New | **Not Started** | Needs keyword detection in OutputAnalyzer. |
| LLM Adapter | Extend | **In Progress** | Claude/Gemini/Codex runtime services exist. |
| Full MCP | Extend | **In Progress** | Server and client exists; parity missing. |
| Vector Memory | New | **Deferred** | Design exists; implementation on hold. |
| Visual Builder | New | **Deferred** | Lower priority. |
| SteamFun PRD | New | **Done** | Mia completed requirements/PRD. |
| /enterprise page | New | **In Progress** | Sam working on crewly-web components. |

---
*Report generated by crewly-core-mia-member-1 (PM).*
