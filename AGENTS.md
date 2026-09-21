# AGENTS.md — MCPSOIDS

Operating contract for AI coding agents, with human-in-the-loop checkpoints.

## Identity

MCPSOIDS is an "Active Robustness" Model Context Protocol implementation:
a hardened Node/Bun MCP server (`mcp_server_ref/`, TypeScript) with a
glassmorphic Control Center (`mcp-control-center/`, git submodule).
Monorepo root is a Bun workspace. License: Apache-2.0.

## Command Reference

All root scripts delegate into `mcp_server_ref/`:

| Task | Command |
|---|---|
| Install | `bun install` |
| Dev server | `bun run dev` |
| Start (with FS + CORS) | `bun run start` |
| Build | `bun run build` (tsc) |
| Lint | `bun run lint` (eslint) |
| Format / check | `bun run format` / `bun run format:check` (prettier) |
| MCP inspector | `bun run --cwd mcp_server_ref inspector` |
| Stress test | `bun run --cwd mcp_server_ref stress` |
| **Full verify (run before declaring done)** | `bun run verify` |

## Verify Contract

`bun run verify` = lint + format:check + tsc build. Must pass before you
report success. There is no test suite in `mcp_server_ref` yet — the
`inspector` and `stress` scripts are the closest smoke checks; do not claim
"tests pass".

## Codebase Map

- `mcp_server_ref/` — the MCP server: `src/cli.ts` entry, tool handlers,
  transport (`src/`), `scripts/inspector.ts`, `scripts/stress_test.ts`
- `mcp-control-center/` — Control Center UI (git submodule; its own repo)
- `mcp_server_ref/` docs + `docs/` — protocol documentation
- `mcp_data/`, `mcp_research_2025/` — research notes

## Conventions

- TypeScript strict via tsc; ESLint + Prettier enforced (`format:check`).
- Bun-first (`packageManager: bun@1.3.14`), Node >=24 engines.
- MCP protocol changes must keep the server compliant with the MCP spec —
  check tool schema round-trips with the inspector after edits.

## Human-in-the-Loop Checkpoints

Ask the human before:
- Enabling or widening FS access or CORS origins (`start` flags).
- Changing the MCP tool surface (add/remove/rename tools or schemas).
- Updating the `mcp-control-center` submodule pointer.

## Danger Zones

- The server exposes filesystem operations when started with `--enable-fs` —
  never run it with FS access against directories with sensitive data.
- Never commit `.env` files; `.env.example` is the template.
- `mcp-control-center` is a submodule — do not commit changes from the
  parent repo that belong in the submodule's own repo.
