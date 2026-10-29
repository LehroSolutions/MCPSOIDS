# Security Policy

## Supported versions
Security fixes target the latest mainline release of **MCPSOIDS**.

## Reporting a vulnerability
Report privately via GitHub Private Vulnerability Reporting (when enabled) or email maintainers.

Include version/commit, reproduction steps, and impact.
Do **not** open public issues for undisclosed vulnerabilities.

## Production expectations
- Never commit `.env`, keys, tokens, or live databases
- Use strong secrets in production
- Keep dependencies updated
- Prefer least-privilege credentials

## Filesystem sandbox

`--enable-fs` scopes every read and listing to `MCP_ROOTS`. Paths are canonicalized with
`realpath` before the containment check, so a symlink or Windows junction inside a root
cannot reach outside it, and a not-yet-created write target is resolved via its nearest
existing ancestor. Rejection messages deliberately omit the allowed roots so they cannot
disclose server paths.

## Authentication

`MCP_AUTH_TOKEN` is **optional**, and when it is unset the server accepts unauthenticated
requests. Any deployment with filesystem access enabled must set it. The container image
refuses to start without it, but `docker-compose.yml` still supplies a placeholder default
(`change-me-mcp-token`) that satisfies that guard and must be overridden.

## Debug tooling

`__debug_stress` is a deliberate denial-of-service primitive, so it is **opt-in only**:
it is served when, and only when, `MCP_ENABLE_DEBUG_TOOLS=true`. `NODE_ENV` no longer
enables it. Its `memory` mode is capped at 256 MB per call and its `cpu` mode yields to
the event loop in short slices, so a burn cannot freeze the process or defeat the request
timeout.

## Rate limiting

`/mcp` allows 1000 requests per 15 minutes. `/audit`, `/metrics`, and `/.well-known` are
limited to 120 per 15 minutes because they read the full audit log or health state per
request.

## Known limitations

Recorded rather than changed, because each alters the tool surface or the `start` flags,
which `AGENTS.md` places behind human approval:

- **No authentication unless `MCP_AUTH_TOKEN` is set.** The shipped `start` script enables
  filesystem access and does not set a token, so a default start is unauthenticated.
- **`--cors-origin` is not validated**, and `--cors-allow-all` is refused only under
  `NODE_ENV=production`, which the shipped scripts never set.
- **`mcp_server_ref/.tool-versions` pins `bun 1.2.19`** against `1.3.14` everywhere else.
- **Stale lint toolchain**: `eslint` 8.57.1 and `@typescript-eslint` 6.21.0; `@types/node`
  is 20.x against `engines.node >= 24`.
- **Root-level files are not format-checked**, because root `format:check` delegates
  entirely into `mcp_server_ref`.
