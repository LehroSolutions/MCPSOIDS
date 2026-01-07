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
```bash
cd mcp_server_ref
npm run build
# Start with File System access enabled
node bin/mcp-server-ref.js --enable-fs --cors-allow-all
```

**Terminal 2 (Frontend):**
```bash
cd mcp-control-center
npm run build
npm start -- -p 3001
```

---

## 🖥️ Feature Usage

### The MCPSOIDS Interface
Navigate to `http://localhost:3001` in your browser.

*   **Health Status**: The top "Health" panel polls the server every few seconds. Valid statuses include `healthy` (green), `degraded` (yellow), or `unhealthy` (red).
*   **Active Tools**: The tool catalog displays available MCP tools.
    *   **File System Tools**: `read_file`, `write_file`, `list_directory`, etc.
    *   **System Tools**: `memory_usage`, `ping`.

### Executing Tools
1.  Click on any tool card (e.g., `list_directory`).
2.  A modal will appear requesting strict JSON arguments.
3.  **Example for `list_directory`**:
    ```json
    {
      "path": "C:/Users/YourName/Documents"
    }
    ```
4.  Click **Execute**. The output (or error) will appear in the result window.

---

## 🛠️ Configuration & Architecture

### Environment Variables

**Frontend (`mcp-control-center/.env.local` or environment)**
*   `NEXT_PUBLIC_MCP_SERVER_URL`: URL of the backend server (default: `http://localhost:3000`).

**Backend (`mcp_server_ref/.env`)**
*   `PORT`: Server port (default: `3000`).
*   `MCP_ENABLE_FS`: Set to `true` to enable file system tools.

### Security Notes
*   **Production Safety**: This reference implementation enables file system access (`--enable-fs`). In a public production environment, ensure strict containerization (Docker) or disable FS access to prevent vulnerabilities.
*   **Rate Limiting**: The server includes basic rate limiting to prevent abuse.

---

## 🐳 Docker Deployment

A `docker-compose.yml` is included for containerized deployment.

```bash
docker-compose up --build
```

This will spin up both services in an isolated network. Note that file system tools will only have access to the mounted volume specified in `docker-compose.yml`.
