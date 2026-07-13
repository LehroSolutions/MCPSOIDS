# MCPSOIDS - Security Guide

## Threat Model
- Policy tampering and unauthorized bypass.
- Leakage of sensitive payload fragments in telemetry.
- Abuse of admin endpoints.

## Controls
- Signed policy bundles and integrity checks.
- Role-separated admin and runtime credentials.
- Payload redaction before audit/metrics emission.
- Strict authn/authz on governance endpoints.

## Governance
- Immutable decision log with actor attribution.
- Change approval workflow for high-impact policies.
- Mandatory rollback plan for enforcement changes.

## Incident Response
- Freeze policy updates.
- Revoke compromised keys/tokens.
- Replay decision traces to assess blast radius.

