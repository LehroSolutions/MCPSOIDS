# MCPSOIDS Server (Active Robustness Implementation)

## Overview
This is the core server for **MCPSOIDS**, the "Gold Standard" reference implementation of the Model Context Protocol (2025 Edition).

## Features Implemented
1.  **Transport**: Streamable HTTP (Express) on Port 3000.
2.  **Protocol**: JSON-RPC 2.0 with strict validation (Zod).
3.  **Active Governance**:
    *   `/.well-known/mcp-health`: Automated health reporting for Janitor Agents.
    *   `__echo`: Mandatory compliance tool.
    *   **Roots Security**: Filesystem access restricted to defined roots (default: CWD).

## How to Run
```bash
# Install
npm install

# Start Server
npm start
```

Environment configuration (optional):

| Variable | Purpose | Default |
| --- | --- | --- |
| MCP_ROOTS | Semicolon-separated allowed roots for filesystem tools | process.cwd() when fs enabled |
| MCP_ENABLE_FS | `true` to enable fs tools without flags | false |
| MCP_ALLOWED_ORIGIN | Single CORS origin (omit to disable CORS) | none |
| MCP_AUTH_TOKEN | If set, requires `Authorization: Bearer <token>` on all endpoints | unset |
| MCP_TOOL_TIMEOUT_MS | Tool call timeout | 30000 |
| MCP_MAX_ACTIVE_REQUESTS | Concurrent request budget before 429 | 50 |
| MCP_JSON_BODY_LIMIT | Express JSON body size limit | 256kb |

## How to Verify (Compliance Agent)
Run the automated inspector to certify the server:
```bash
npm run inspector
```
Expected output:
> ✨ ACTIVE ROBUSTNESS CERTIFIED ✨

## Project Structure
*   `src/protocol`: JSON-RPC definitions.
*   `src/features`: Roots security & Health monitoring.
*   `src/transport`: Express HTTP server.
*   `scripts/inspector.ts`: The Client Simulator / Compliance Agent.
