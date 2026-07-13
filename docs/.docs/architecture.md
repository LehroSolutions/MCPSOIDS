# MCPSOIDS Architecture

  ## Intent
  Production-minded MCP server reference with operator control center and Roots security laboratory.

  ## Runtime shape
  - Domain: **Agent tool runtime / MCP**
  - Primary stack: Node.js, TypeScript, Express, MCP protocol
  - Key entrypoints:
- `mcp_server_ref/src/index.ts`
- `mcp_server_ref/src/transport/http.ts`
- `mcp_server_ref/public/index.html`

  ## Boundaries
  - Validate inputs at trust boundaries.
  - Keep authorization explicit near data access.
  - Prefer recoverable errors over silent failure.
  - Keep side effects isolated and observable.

  ## Related
  - [Design System](./design-system.md)
  - [Security](./security.md)
  - [ADR-0001](./adr-0001-docs-system.md)
  - [Roadmap](./roadmap.md)
