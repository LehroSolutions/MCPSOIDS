# MCPSOIDS

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-production--ready-success.svg)
![Protocol](https://img.shields.io/badge/MCP-Compliant-emerald.svg)

> **MCPSOIDS** is the definitive "Active Robustness" implementation of the Model Context Protocol. It combines a hardened Node.js MCP server with an avant-garde, glassmorphic Control Center for real-time monitoring and tool execution.

---

## 💎 The Vision

MCPSOIDS moves beyond simple "chat bot tools" to create a governed, observable ecosystem creates a bridge between AI agents and local system operations.

*   **Visual Dominance**: A "Cyberpunk Glassmorphism" UI that makes monitoring system health a visual delight.
*   **Production Hardened**: Built with rate limiting, error boundaries, and strict type safety.
*   **Dual Architecture**: Decoupled Backend (Server) and Frontend (Control Center) for maximum scalability.

## 🚀 Key Features

### 🧠 Backend (The Cortex)
*   **Full MCP Compliance**: Implements the standardized protocol for tool discovery and execution.
*   **Native Tools**:
    *   📂 **File System**: `list_directory`, `read_file`, `write_file` (sandboxed).
    *   📊 **System**: `memory_usage`, `ping`.
*   **Safety First**: Built-in rate limiting and origin validation.

### 👁️ Control Center (The Eye)
*   **Next.js 16 (Turbopack)**: Blazing fast performance.
*   **Real-time Telemetry**: Polls server health and connection status.
*   **Interactive Tool Catalog**: Execute tools directly from the UI with stricter JSON validation.
*   **Avant-Garde Design**: Tailwind CSS v4 driven aesthetics.

---

## ⚡ Quick Start

### Windows (Automatic)
We provide a unified launcher for Windows users.

```powershell
.\start_production.ps1
```

This will automatically:
1.  Boot the **MCP Server** (Port 3000).
2.  Launch the **Control Center** (Port 3001).
3.  Open the necessary terminal windows.

### Manual Setup

**1. The Server**
```bash
cd mcp_server_ref
npm install
npm run build
$env:MCP_AUTH_TOKEN = "local-mcp-token"
node bin/mcp-server-ref.js --enable-fs --cors-origin http://localhost:3001
```

**2. The Control Center**
```bash
cd mcp-control-center
npm install
npm run build
$env:MCP_SERVER_URL = "http://127.0.0.1:3000"
$env:MCP_AUTH_TOKEN = "local-mcp-token"
$env:MCPSOIDS_ADMIN_TOKEN = "local-admin-token"
$env:MCPSOIDS_UI_SECRET = "local-ui-secret"
$env:MCPSOIDS_ALLOW_PRIVATE_MCP = "true"
npm start -- -p 3001
```

---

## 🛠️ Architecture

```mermaid
graph TD
    User[User / AI Agent] -->|HTTP/JSON| Frontend[Control Center]
    Frontend -->|MCP Protocol| Backend[MCP Server]
    Backend -->|Access| FS[File System]
    Backend -->|Access| Sys[System Specs]
```

## 📦 Tech Stack

*   **Runtime**: Node.js v20+
*   **Framework**: Next.js 16.0.8 (React 19)
*   **Language**: TypeScript 5.x
*   **Styling**: Tailwind CSS 4 + Framer Motion
*   **Testing**: Playwright (E2E)

## 📄 License

This project is licensed under the MIT License - see the `package.json` file for details.

---

*Est. 2026 // LehroSolutions // Advanced Agentic Operations*
