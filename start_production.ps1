$root = $PSScriptRoot
$mcpAuthToken = if ($env:MCP_AUTH_TOKEN) { $env:MCP_AUTH_TOKEN } else { [guid]::NewGuid().ToString("N") }
$adminToken = if ($env:MCPSOIDS_ADMIN_TOKEN) { $env:MCPSOIDS_ADMIN_TOKEN } else { [guid]::NewGuid().ToString("N") }
$uiSecret = if ($env:MCPSOIDS_UI_SECRET) { $env:MCPSOIDS_UI_SECRET } else { [guid]::NewGuid().ToString("N") }

Write-Host "Starting MCP Server (Backend)..."
# Using Start-Process to launch in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:MCP_AUTH_TOKEN='$mcpAuthToken'; `$env:MCP_AUDIT_LOG_PATH='$root\mcp_data\audit\audit-log.jsonl'; cd '$root\mcp_server_ref'; Write-Host 'MCP Server (Production Mode)'; node bin/mcp-server-ref.js --enable-fs --cors-origin http://localhost:3001"

Start-Sleep -Seconds 2

Write-Host "Starting MCPSOIDS (Frontend)..."
# Using Start-Process to launch in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:MCP_SERVER_URL='http://127.0.0.1:3000'; `$env:MCP_AUTH_TOKEN='$mcpAuthToken'; `$env:MCPSOIDS_ADMIN_TOKEN='$adminToken'; `$env:MCPSOIDS_UI_SECRET='$uiSecret'; `$env:MCPSOIDS_ALLOW_PRIVATE_MCP='true'; cd '$root\mcp-control-center'; Write-Host 'MCPSOIDS (Production Mode)'; npm start -- -p 3001"

Write-Host "Both applications have been launched in separate terminal windows."
Write-Host "Frontend: http://localhost:3001"
Write-Host "Backend: http://localhost:3000"
Write-Host "Operator token: $adminToken"
