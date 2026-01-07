$root = $PSScriptRoot

Write-Host "Starting MCP Server (Backend)..."
# Using Start-Process to launch in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\mcp_server_ref'; Write-Host 'MCP Server (Production Mode)'; node bin/mcp-server-ref.js --enable-fs --cors-allow-all"

Start-Sleep -Seconds 2

Write-Host "Starting MCPSOIDS (Frontend)..."
# Using Start-Process to launch in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\mcp-control-center'; Write-Host 'MCPSOIDS (Production Mode)'; npm start -- -p 3001"

Write-Host "Both applications have been launched in separate terminal windows."
Write-Host "Frontend: http://localhost:3001"
Write-Host "Backend: http://localhost:3000"
