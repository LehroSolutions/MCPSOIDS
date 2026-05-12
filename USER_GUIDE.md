# MCPSOIDS - User Guide

## Overview

**MCPSOIDS** is a production-ready implementation of the Model Context Protocol (MCP). It consists of two primary components designed to work in tandem:

1.  **MCP Server (Backend)**: A robust Node.js server implementing the MCP protocol, featuring file system access, rate limiting, and comprehensive logging.
2.  **MCPSOIDS (Frontend)**: A Next.js 16 (React 19) web application providing a "Glassmorphism" UI to interact with the server, monitor health, and execute tools.

---

## 🚀 Quick Start

### Prerequisites
*   Node.js v20+
*   npm

### 1. Installation

Clone the repository and install dependencies for both services:

```bash
# Install Backend Dependencies
cd mcp_server_ref
npm install

# Install Frontend Dependencies
cd ../mcp-control-center
npm install
```

### 2. Running in Production

We provide a specialized PowerShell launcher for Windows users that handles everything automatically.

**Option A: Using the Launcher (Recommended)**

Run the following command from the root directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\start_production.ps1
```

This will:
*   Launch the **MCP Server** on port `3000` in a new window.
*   Launch **MCPSOIDS** on port `3001` in a new window.

**Option B: Manual Startup**

**Terminal 1 (Backend):**
```powershell
cd mcp_server_ref
npm run build
$env:MCP_AUTH_TOKEN = "local-mcp-token"
$env:MCP_AUDIT_LOG_PATH = "..\mcp_data\audit\audit-log.jsonl"
node bin/mcp-server-ref.js --enable-fs --cors-origin http://localhost:3001
```

**Terminal 2 (Frontend):**
```powershell
cd mcp-control-center
npm run build
$env:MCP_SERVER_URL = "http://127.0.0.1:3000"
$env:MCP_AUTH_TOKEN = "local-mcp-token"
$env:MCPSOIDS_ADMIN_TOKEN = "local-admin-token"
$env:MCPSOIDS_UI_SECRET = "local-ui-secret"
$env:MCPSOIDS_ALLOW_PRIVATE_MCP = "true"
npm start -- -p 3001
```

---

## 🖥️ Feature Usage

### The MCPSOIDS Interface
Navigate to `http://localhost:3001` in your browser.

*   **Health Status**: The top "Health" panel polls the server every few seconds. Valid statuses include `healthy` (green), `degraded` (yellow), or `unhealthy` (red).
*   **Active Tools**: The tool catalog displays available MCP tools.
    *   **File System Tools**: `fs/ls`, `fs/read_file`.
    *   **Compliance Tool**: `__echo`.
*   **Audit Trail**: Tool calls are recorded as hashed append-only entries. Raw arguments and raw outputs are not stored.
*   **Operator Session**: In production, enter `MCPSOIDS_ADMIN_TOKEN` in the Operator Session panel before executing tools.

### Executing Tools
1.  Click **Interactive Run** on any tool card.
2.  Fill the generated argument fields. Required fields are validated before the request is sent.
3.  Click **Run Tool**. The output or error appears in the result window, and the audit panel updates with a hashed record.

---

## 🛠️ Configuration & Architecture

### Environment Variables

**Frontend (`mcp-control-center/.env.local` or environment)**
*   `MCP_SERVER_URL`: Server-side URL of the backend MCP server.
*   `MCP_AUTH_TOKEN`: Backend bearer token used only by the Next.js gateway.
*   `MCPSOIDS_ADMIN_TOKEN`: Operator token used to create a signed admin session in production.
*   `MCPSOIDS_UI_SECRET`: HMAC secret for signed UI cookies.
*   `MCPSOIDS_ALLOW_PRIVATE_MCP`: Set to `true` for local production launches that target `127.0.0.1`.

**Backend (`mcp_server_ref/.env`)**
*   `PORT`: Server port (default: `3000`).
*   `MCP_ENABLE_FS`: Set to `true` to enable file system tools.
*   `MCP_AUTH_TOKEN`: If set, requires `Authorization: Bearer <token>` on backend endpoints.
*   `MCP_AUDIT_LOG_PATH`: Append-only JSONL audit log location.
*   `MCP_POLICY_ALLOW_TOOLS` / `MCP_POLICY_DENY_TOOLS`: Comma-separated glob patterns for OSS tool policy.
*   `MCP_POLICY_MODE`: `enforce` or `dry-run`.

### Security Notes
*   **Production Safety**: This reference implementation enables file system access (`--enable-fs`). In a public production environment, ensure strict containerization (Docker) or disable FS access to prevent vulnerabilities.
*   **Rate Limiting**: The server includes basic rate limiting to prevent abuse.
*   **Same-Origin Gateway**: Browser code calls `/api/mcp/*`; backend URLs and bearer tokens are not exposed to the client bundle.

---

## 🐳 Docker Deployment

A `docker-compose.yml` is included for containerized deployment.

```bash
docker-compose up --build
```

This will spin up both services in an isolated network. Note that file system tools will only have access to the mounted volume specified in `docker-compose.yml`.
