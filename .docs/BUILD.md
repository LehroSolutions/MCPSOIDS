# MCPSOIDS - Build Guide

## Purpose
MCPSOIDS is an MCP governance and observability platform for tool policies, request tracing, anomaly detection, and service-level controls.

## Local Build Scope (Phase 1)
- Policy evaluation engine interfaces.
- Gateway intercept pipeline and request classifiers.
- Audit event schema and storage adapters.
- Admin/API surface for governance operations.

## Suggested Structure
- `gateway\` ingress, auth, and interception logic.
- `policy\` rule engine and decision traces.
- `audit\` immutable event contracts.
- `api\` external and internal operator endpoints.

## Quality Gates
- Policy decisions are fully explainable.
- Audit trail is append-only and queryable.
- No unauthenticated governance actions.

