# MCPSOIDS - Production Guide

## Deployment Model
- Gateway service for MCP traffic interception.
- Policy service for evaluation and rollout management.
- Audit/observability backend with dashboards and alerts.

## Required Configuration
- `MCPSOIDS_ADMIN_SECRET`
- `POLICY_BUNDLE_VERSION`
- `AUDIT_BACKEND_URL`
- `OBSERVABILITY_SINK`

## Runtime Flow
1. Receive MCP request/response event.
2. Evaluate policy and enforcement mode.
3. Emit decision trace and audit record.
4. Publish metrics and anomaly signals.

## Reliability
- Fail-safe modes configurable per policy class.
- Buffered audit transport with backpressure controls.
- Canary rollout for policy bundle updates.

