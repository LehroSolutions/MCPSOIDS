import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const fixtureParent = path.resolve('.mcpsoids-private');
fs.mkdirSync(fixtureParent, { recursive: true });
const serverFixture = fs.mkdtempSync(path.join(fixtureParent, 'e2e-'));
fs.writeFileSync(path.join(serverFixture, 'sample.txt'), 'Synthetic MCP filesystem fixture');

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:3421',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL },
        },
    ],
    webServer: [
        {
            command: 'node ../../../mcp_server_ref/bin/mcp-server-ref.js --host 127.0.0.1 --port 3420 --enable-fs --root .',
            cwd: serverFixture,
            port: 3420,
            reuseExistingServer: false,
            env: {
                NODE_ENV: 'production',
                MCP_AUTH_TOKEN: 'playwright-backend-token-at-least-32-characters',
                MCP_AUDIT_LOG_PATH: path.join(serverFixture, 'audit.jsonl'),
            },
        },
        {
            command: 'node .next/standalone/server.js',
            url: 'http://localhost:3421',
            reuseExistingServer: false,
            env: {
                NODE_ENV: 'production',
                MCP_SERVER_URL: 'http://127.0.0.1:3420',
                PORT: '3421',
                HOSTNAME: '127.0.0.1',
                MCP_AUTH_TOKEN: 'playwright-backend-token-at-least-32-characters',
                MCPSOIDS_ALLOW_PRIVATE_MCP: 'true',
                MCPSOIDS_UI_SECRET: 'playwright-ui-secret',
                MCPSOIDS_ADMIN_TOKEN: 'playwright-admin-token',
            },
        },
    ],
});
