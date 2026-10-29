# MCPSOIDS UI

Next.js dashboard for monitoring the MCPSOIDS Server and its "Active Robustness" signals.

## Prerequisites

- Run the reference server in `../mcp_server_ref` (default: `http://localhost:3000`).

## Run (dev)

From this folder:

```bash
bun install --frozen-lockfile
```

Set the server URL for the server-side gateway (Windows PowerShell):

```powershell
$env:MCP_SERVER_URL = "http://127.0.0.1:3000"
$env:MCP_AUTH_TOKEN = "local-mcp-token" # only if the backend uses MCP_AUTH_TOKEN
$env:MCPSOIDS_UI_SECRET = "local-ui-secret"
$env:MCPSOIDS_ADMIN_TOKEN = "local-admin-token"
```

Start the dashboard on a non-conflicting port (recommended):

```bash
bun run dev
```

Open `http://localhost:3001`.

## Notes

- Browser code calls same-origin `/api/mcp/*` routes; backend URLs and bearer tokens stay server-side.
- Tool execution uses CSRF protection and records hashed audit entries when the backend audit log is enabled.
- Network failures are shown as actionable UI errors (no silent failures).

See [production operations](../PRODUCTION.md) for secure configuration, local
production E2E checks, signed session expiry, and audit recovery.
