# Architecture Decision Records (ADRs)

## ADR-001: Adoption of JSON-RPC 2.0 over Streamable HTTP

**Status**: Accepted
**Context**: We need a transport-agnostic message format that supports request/response, notifications (for progress), and bi-directional communication (for sampling).
**Decision**: We will use **JSON-RPC 2.0** as the wire format, transported over **Streamable HTTP** (HTTP/2+ with Chunked Transfer).
**Consequences**:
*   *Positive*: Extensible, text-based (debuggable), standardizes error handling. Streamable HTTP bypasses corporate firewalls better than WebSocket while maintaining persistent connections.
*   *Negative*: Slightly higher serialization overhead than gRPC/Protobuf.
**Alternatives Considered**:
*   *REST*: Too chatty, lacks stateful connection concepts needed for "Sampling".
*   *gRPC*: Too complex for simple script-based tools; poor browser support without proxies.

## ADR-002: Client-Authoritative Security Model ("Roots")

**Status**: Accepted
**Context**: Security is the #1 blocker for enterprise AI adoption. Existing plugin systems rely on "Server Trust" (trusting the API provider).
**Decision**: We implement an **Inversion of Control** security model. The *Client* (User/Host) defines "Roots"—specific filesystem paths or resource URIs that the Server is allowed to access. The Server has *no* inherent permissions.
**Consequences**:
*   *Positive*: Zero Trust architecture. A compromised server cannot scan the user's entire tailored filesystem.
*   *Negative*: UX friction. Users must explicitly grant permissions (like mobile app permissions).

## ADR-003: Stateless Server Architecture

**Status**: Proposed
**Context**: To scale the "Agent Web", servers must be lightweight and reliable.
**Decision**: MCP Servers should be **Stateless**. They should not retain conversation history or session state between connections. State should ideally reside in the Client (Context Window) or a persistent database.
**Consequences**:
*   *Positive* Horizontal scalability (can spin up 100 instances of a Tool Server). Simplifies restart/recovery.
*   *Negative*: Complex multi-turn workflows require passing state tokens back and forth.
