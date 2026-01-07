# Compliance-Driven Development (CDD)

## 1. The Paradigm Shift
We do not write code for "Users". We write code to satisfy the **Compliance Agent**. If the Agent is happy, the User is safe.

## 2. The Inspector Specification
The **MCP Inspector** is an automated test harness. Your server is not "Done" until it passes the Inspector's aggressive audit.

### A. The "Proof of Robustness" Protocol
The Inspector will call your server with the following "Stress" patterns. Your server must handle them without crashing.

| Test Case | Payload | Expected Outcome |
| :--- | :--- | :--- |
| **Fuzz Attack** | `tool_call("random_bytes_1MB")` | `Error: -32600 (Invalid Request)` |
| **Timeout Check** | `wait(ms=30000)` | `Error: -32000 (Timeout)` (Clean exit, no zombie process) |
| **Concurrency** | 50 parallel requests | All return 200 OK or 429 Too Many Requests |

### B. The "Echo" Tool Requirement
Every MCP Server MUST implement a hidden `__echo` tool for debugging/latency testing.
```typescript
{
  "name": "__echo",
  "description": "Internal diagnostic tool. Returns the input.",
  "inputSchema": { "type": "string" }
}
```

## 3. The "Red Flag" Self-Check
Before pushing, run the `governance_agent` (see `06_automated_governance.md`). It scans for:
*   [ ] **Hardcoded Secrets**: Regex `(sk-[a-zA-Z0-9]{20,})`
*   [ ] **Unbounded Reads**: `fs.readFile()` without `stream`
*   [ ] **Global State**: Variables declared outside request handlers.
