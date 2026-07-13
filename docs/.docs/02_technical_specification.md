# Technical Specification & Tech Stack

## 1. Technology Stack Justification

| Component | Choice | Why This? | Risk/Mitigation |
| :--- | :--- | :--- | :--- |
| **Protocol** | JSON-RPC 2.0 | Standard, simple, language-agnostic | Verbose: Use compression (gzip) |
| **Transport** | Streamable HTTP | Firewalls love HTTP; handles long-lived streams | Browser support: Use Polyfills |
| **SDK Language** | TypeScript & Python | Covers 95% of AI/Web Dev ecosystem | C#/Java Laggards: Community wrappers |
| **Auth** | OAuth 2.0 | Enterprise requirement for standard auth flows | Complexity: Provide helper libs |

## 2. Non-Functional Requirements (NFRs)

### Performance
*   **Latency**: Protocol overhead must be **< 20ms** per roundtrip (excluding network).
*   **Throughput**: Must support sending **1MB+** binary blobs (images/logs) via Resource templates without blocking the control channel.

### Security
*   **Isolation**: Servers must run in sandboxed environments (Docker/Wasm) in production.
*   **Privacy**: No data leaves the defined "Roots" without explicit user consent.

### Reliability
*   **Graceful Degradation**: If a Server crashes, the Client must not hang. It should remove the tools from the context and notify the user.
*   **Version Negotiation**: Client and Server must handshake capabilities (e.g., "I support Sampling") on connect.

## 3. Schema Definitions
All tools must be defined using **JSON Schema Draft 2020-12**.
*   *Requirement*: Descriptions must be optimized for LLM semantic understanding, not just human readability.

## 4. Automated Compliance & Health

### A. The Health Check Protocol
Every MCP Server MUST implement `/.well-known/mcp-health`. This is not for humans; it is for the "Janitor Agent".

```json
// GET /.well-known/mcp-health
{
  "status": "green", // or "yellow", "red"
  "metrics": {
    "active_connections": 12,
    "memory_usage_mb": 45.2,
    "error_rate_1m": 0.01
  },
  "self_heal_hint": "restart_recommended" // Optional hint for the orchestrator
}
```

### B. Machine-Readable NFRs (The "Budget")
CI pipelines must validate against this `nfr_budget.json`:

```json
{
  "$schema": "https://mcp.io/schemas/nfr-budget.json",
  "limits": {
    "cold_start_ms": 500,
    "max_memory_mb": 256,
    "image_size_mb": 50
  },
  "required_endpoints": ["/_health", "/_metrics"]
}
```
