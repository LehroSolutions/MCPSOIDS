# Operations

**Counterparts:** [`operations.html`](operations.html) · [`operations.json`](operations.json)

- **Section:** Operations
- **Audience:** Operators and maintainers
- **Use when:** Running, diagnosing, or releasing the product.
- **Status:** Current
- **Last reviewed:** 2026-07-13

## Purpose

Provide the operational route for the current release without inventing deployment claims.

## On this page

- [Runtime signals](#runtime-signals)
- [Release routine](#release-routine)
- [Verification](#verification)

## Runtime signals

- Monitor health, metrics, audit entries, and integrity checks as one operational loop.

## Release routine

1. Run the product verification command: `TypeScript syntax/transpile check`.
2. Run `pnpm docs:check`.
3. Update the release manifest through `pnpm docs:build`.
4. Package only source, approved examples, and current documentation.

## Verification

- Record successful checks in an evidence log.
- Keep environment-specific credentials and data outside the public release.

## Related guides

- [Architecture](architecture.md)
- [Security](security.md)
- [Quality](quality.md)
