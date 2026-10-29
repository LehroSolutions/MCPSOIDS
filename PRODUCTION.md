# Production operations

Use Node 24 and Bun 1.3.14. Install with `bun install --frozen-lockfile` at the root and `bun install --cwd mcp-control-center --frozen-lockfile` for the independently locked UI. Run `bun run verify` for server lint/format/build/tests, UI lint/build/tests, and docs. After the build, `bun run --cwd mcp-control-center test:e2e` exercises the production UI against the built server on isolated ports 3420/3421. Install Chromium with `bunx --cwd mcp-control-center playwright install chromium` if needed. E2E uses synthetic credentials only and does not reuse an existing server.

Set `NODE_ENV=production` and a random `MCP_AUTH_TOKEN` of at least 32 characters for the server. Keep filesystem tools disabled unless needed, then supply an explicit narrow root. The server refuses unauthenticated public binds. Numeric limits reject invalid or unbounded values at startup. Defaults are 50 active requests, 30-second tool timeout, and 200 audit entries per read; the supported maximum timeout is five minutes.

For the UI, configure `MCP_SERVER_URL`, the same `MCP_AUTH_TOKEN`, a distinct `MCPSOIDS_ADMIN_TOKEN`, and a random `MCPSOIDS_UI_SECRET`. Set `MCPSOIDS_ALLOW_PRIVATE_MCP=true` only for an intended private backend. Run behind HTTPS so secure session cookies work. Signing the session expiry enforces the eight-hour limit on the server; older unbounded cookies are rejected. The UI removes the submitted admin token from browser session storage after unlocking. Ending a session clears its cookies; rotating `MCPSOIDS_UI_SECRET` invalidates all issued cookies, including copied cookies.

The gateway rejects forged CSRF requests, replaces client-supplied audit identity with its signed session identity, and times out backend calls after 15 seconds. Health and audit polling use bounded intervals to fit the server's read budget. MCP initialization negotiates protocol version 2025-03-26; tool results use MCP text content blocks. SSE subscriptions and resumable sessions are not implemented.

Run one server writer per audit JSONL file. Restrict the data directory to the service account. Back up configuration separately from the audit file; logs store hashes and sensitive-data flags rather than tool arguments. Verify `/audit/integrity` after a restart or restore. If integrity fails, preserve the damaged file for investigation and restore a verified backup while the server is stopped. Roll back using the previous built artifacts and compatible configuration; never delete audit history merely to clear an alert.

Audit appends flush to disk before returning success. A failed append rejects that
request and invalidates the cached tail hash; after the storage problem is repaired,
later requests can continue without restarting or discarding history. A malformed
tail blocks continuation until a verified backup is restored. Recent-entry reads
scan backwards from the file tail, while integrity checks stream the history to
avoid loading the entire audit file into memory. CI exercises the production
control-center journeys after building both components.

Before deployment, verify HTTPS/cookies on the target domain, intended CORS origins and filesystem roots, audit retention and recovery on target storage, and load at expected concurrency. These checks require deployment configuration and are distinct from local production-build tests.
