# How to Use MCPSOIDS

MCPSOIDS is an MCP server with an operator control center and Roots security laboratory.

## 1) Install

```bash
bun install
bun run build
```

## 2) Start

```bash
export MCP_AUTH_TOKEN="change-me-strong-token"
bun run start
```

Open the server origin for the control center shell.

## 3) Operator workflow
1. Confirm health/heartbeat
2. Browse capability catalog
3. Use Roots lab (`fs/ls`, `fs/read_file`) to verify path bounds
4. Keep auth tokens in environment variables only

## 4) Production checklist
- Set `MCP_AUTH_TOKEN`
- Restrict CORS origin
- Enable filesystem tools only when needed
- Terminate TLS at your reverse proxy

## Related
- [INSTALL.md](../../INSTALL.md)
- [Architecture](./architecture.md)
- [Security](./security.md)
