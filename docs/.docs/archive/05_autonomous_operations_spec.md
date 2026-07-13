# Autonomous Operations Specification

## 1. The "Janitor Agent" Sidecar
In production, every MCP Server is paired with a lightweight "Janitor" process. This is the **Active Robustness** layer.

### Responsibilities
1.  **Watchdog**: Polls `/.well-known/mcp-health` every 5 seconds.
2.  **Reaper**: If `memory_usage_mb > budget.max_memory_mb` (from `nfr_budget.json`), it sends `SIGTERM` to the server.
3.  **Reporter**: Pushes crash logs to the central "Observability Trace" before the pod dies.

## 2. The Signal Protocol
Servers must communicate their distress *before* they crash. We use standard JSON-RPC Notifications for this.

### `system.overload`
Sent when the internal queue is > 80% full.
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/system.overload",
  "params": {
    "level": "critical",
    "backoff_ms": 5000,
    "reason": "db_connection_pool_exhausted"
  }
}
```
**Client Behavior**: Upon receipt, the Client (Orchestrator) MUST stop sending new requests for `backoff_ms` and route traffic to a replica.

## 3. Maintenance Windows
Servers can request a "Graceful Exit" via `system.maintenance`.
*   *Use Case*: Updating local vector indices or clearing temp caches.
*   *Protocol*: Server sends `system.maintenance`, Client finishes active requests and disconnects.
