import { test, expect, Page } from '@playwright/test';

async function gotoApp(page: Page) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Admin token', { exact: true }).fill('playwright-admin-token');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await expect(page.getByText('Operator session active')).toBeVisible();
}

test.describe('MCP Gateway Tool Execution', () => {
    test('rejects unauthenticated reads and incorrect operator tokens', async ({ page }) => {
        await page.goto('/');
        expect((await page.request.get('/api/mcp/health')).status()).toBe(401);
        await page.getByLabel('Admin token', { exact: true }).fill('incorrect-synthetic-token');
        await page.getByRole('button', { name: 'Unlock', exact: true }).click();
        await expect(page.locator('section').filter({ hasText: 'Operator Session' }).getByRole('status')).toContainText('Operator session required');
        expect(await page.evaluate(() => sessionStorage.getItem('mcpsoids.operatorToken'))).toBeNull();
    });

    test('replaces forged client audit identity with the authenticated gateway identity', async ({ page }) => {
        await gotoApp(page);
        const recorded = await page.evaluate(async () => {
            const csrf = await (await fetch('/api/mcp/csrf')).json();
            const response = await fetch('/api/mcp/rpc', {
                method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
                body: JSON.stringify({ jsonrpc: '2.0', id: 'identity-regression', method: 'tools/call', params: { name: '__echo', arguments: { message: 'synthetic identity regression' }, sessionId: 'forged-session', agentId: 'forged-agent' } }),
            });
            const result = await response.json();
            const audit = await (await fetch('/api/mcp/audit')).json();
            return { result, entry: audit.entries.find((entry: { requestId: string }) => entry.requestId === 'identity-regression'), sessionId: csrf.sessionId };
        });
        expect(recorded.result.result.content).toEqual([{ type: 'text', text: 'synthetic identity regression' }]);
        expect(recorded.entry.agentId).toBe('control-center-ui');
        expect(recorded.entry.sessionId).toBe(recorded.sessionId);
        expect(recorded.entry.sessionId).not.toBe('forged-session');
    });

    test('opening another tool starts a fresh execution session', async ({ page }) => {
        await gotoApp(page);
        await page.getByRole('button', { name: 'Interactive Run __echo' }).click();
        await page.locator('#input-message').fill('discarded pending input');
        await page.getByRole('button', { name: 'Close', exact: true }).first().click();
        await page.getByRole('button', { name: 'Interactive Run fs/read_file' }).click();
        await expect(page.locator('#input-path')).toHaveValue('');
        await page.getByRole('button', { name: 'Close', exact: true }).first().click();
        await page.getByRole('button', { name: 'Interactive Run __echo' }).click();
        await expect(page.locator('#input-message')).toHaveValue('');
    });

    test('executes __echo through the same-origin RPC gateway and records audit state', async ({ page }, testInfo) => {
        await gotoApp(page);

        await expect(page.getByText('ACTIVE CAPABILITIES')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Audit Trail')).toBeVisible();

        await page.getByRole('button', { name: 'Interactive Run __echo' }).click();
        await expect(page.getByRole('button', { name: 'Run Tool' })).toBeVisible();
        await page.locator('#input-message').fill('Hello E2E Test');

        const rpcRequest = page.waitForRequest((request) =>
            request.method() === 'POST' && request.url().includes('/api/mcp/rpc')
        );
        await page.getByRole('button', { name: 'Run Tool' }).click();
        await rpcRequest;

        await expect(page.getByText('SUCCESS')).toBeVisible({ timeout: 15000 });
        await page.getByRole('button', { name: 'Close' }).nth(1).click();
        await expect(page.getByText('Execution History')).toBeVisible();
        await page.getByRole('button', { name: 'Refresh audit trail' }).click();
        await expect(page.getByText('CHAIN VALID')).toBeVisible({ timeout: 7000 });
        await page.screenshot({ path: testInfo.outputPath('production-tool-journey.png'), fullPage: true });
    });

    test('rejects missing or invalid CSRF tokens at the gateway', async ({ page }) => {
        await gotoApp(page);

        const missing = await page.request.post('/api/mcp/rpc', {
            data: {
                jsonrpc: '2.0',
                id: 'missing-csrf',
                method: 'tools/list',
                params: {},
            },
        });
        expect(missing.status()).toBe(403);

        await page.request.get('/api/mcp/csrf');
        const invalid = await page.request.post('/api/mcp/rpc', {
            headers: {
                'x-csrf-token': 'invalid-token',
            },
            data: {
                jsonrpc: '2.0',
                id: 'invalid-csrf',
                method: 'tools/list',
                params: {},
            },
        });
        expect(invalid.status()).toBe(403);
    });

    test('blocks invalid schema arguments before sending tool execution', async ({ page }) => {
        await gotoApp(page);

        await expect(page.getByText('ACTIVE CAPABILITIES')).toBeVisible({ timeout: 15000 });
        await page.getByRole('button', { name: 'Interactive Run __echo' }).click();
        await expect(page.getByRole('button', { name: 'Run Tool' })).toBeVisible();

        let rpcSeen = false;
        page.on('request', (request) => {
            if (request.method() === 'POST' && request.url().includes('/api/mcp/rpc')) {
                rpcSeen = true;
            }
        });

        await page.getByRole('button', { name: 'Run Tool' }).click();
        await expect(page.getByText('Fix the highlighted arguments before running this tool.')).toBeVisible();
        await expect(page.getByText('message is required')).toBeVisible();
        expect(rpcSeen).toBe(false);
    });

    test('shows roots security denial for filesystem traversal', async ({ page }) => {
        await gotoApp(page);

        await expect(page.getByText('ACTIVE CAPABILITIES')).toBeVisible({ timeout: 15000 });
        await page.getByRole('button', { name: 'Interactive Run fs/read_file' }).click();
        await expect(page.getByRole('button', { name: 'Run Tool' })).toBeVisible();
        await page.locator('#input-path').fill('../package.json');

        await page.getByRole('button', { name: 'Run Tool' }).click();
        await expect(page.getByText('FAILED')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('pre').filter({ hasText: /Security Violation|Access denied/ }).first()).toBeVisible();
    });
});

test('ends the operator session and rejects subsequent authenticated reads', async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('button', { name: 'End operator session' }).click();
    await expect(page.getByText('Operator session ended')).toBeVisible();
    expect((await page.request.get('/api/mcp/health')).status()).toBe(401);
});

test('reads an allowed synthetic file through the production gateway', async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('button', { name: 'Interactive Run fs/read_file' }).click();
    await page.locator('#input-path').fill('sample.txt');
    await page.getByRole('button', { name: 'Run Tool' }).click();
    await expect(page.locator('pre').filter({ hasText: 'Synthetic MCP filesystem fixture' }).first()).toBeVisible();
});
