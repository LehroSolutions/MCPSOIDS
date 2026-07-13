        # Audit & Improvements — 2026-07-10

        Product: **MCPSOIDS**

        ## Audit findings addressed
        - High: no package.json at repo root; bun install failed unless cd into mcp_server_ref
- High: nested package without workspace root

        ## Improvements applied
        - Added root package.json workspace over mcp_server_ref
- Added bunfig.toml, INSTALL.md, root scripts for build/start

        ## Install verification
        - JS/TS packages: run `bun install` from the directory containing `package.json` (repo root for workspace packages).
        - Python packages: use venv + pip (`INSTALL.md`).

        ## Related
        - [How to Use](./how-to-use.md)
        - [Security](./security.md)
        - [ADR-0003 Package Manager](./adr-0003-package-manager-bun.md)
