# Build Issues — 2026-07-13

**Counterparts:** [HTML](BUILD_ISSUES_2026-07-13.html) · [JSON](BUILD_ISSUES_2026-07-13.json)

- **Section:** Evidence logs
- **Audience:** Maintainers and release engineers
- **Use when:** Reviewing the Bun workspace filter CI failure and remediation.
- **Status:** Current
- **Last reviewed:** 2026-07-13

## Failure

GitHub Actions failed on `bun --filter mcpsoids-server run format:check` because the workspace filter did not resolve the nested server package.

## Resolution

Root scripts now use an explicit shell directory boundary instead of a Bun workspace filter:

```bash
cd mcp_server_ref && bun run format:check
```

The same direct execution pattern is used for development, start, build, lint, and formatting commands.

## Verification

- Root scripts resolve to `mcp_server_ref` explicitly.
- CI workflow YAML parses successfully.
- Run `bun install`, then `bun run format:check` from the repository root to validate in GitHub Actions.

## Related guides

- [Current quality guide](../current/quality.md)
- [Current evidence log](../current/evidence-log.md)
