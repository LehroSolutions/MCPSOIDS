# MCPSOIDS - Copilot Skill

---
name: mcpsoids-dev
description: Build MCP governance, policy enforcement, and observability features in MCPSOIDS with secure and auditable workflows.
---

## Use This Skill For
- Policy engine and gateway enforcement changes.
- Audit pipeline and observability improvements.
- Admin/API governance feature delivery.

## Rules
- Every policy decision must include trace metadata.
- Never log secrets or raw sensitive payloads.
- Preserve rollback path for policy enforcement updates.

## Standard Workflow
1. Define policy/observability change.
2. Add unit and integration coverage.
3. Validate decision trace/audit behavior.
4. Roll out via staged policy bundle.

## Frontend Skill Track (Detailed)
### Frontend Scope
- Policy editor, decision trace explorer, anomaly dashboard, and governance admin console.

### Context Gathering
- Read policy bundle schema and decision trace payload shape.
- Confirm role/permission model for admin actions.

### UI Execution Protocol
1. Build policy list + version browser.
2. Add decision trace explorer with filterable timeline.
3. Add anomaly charts with drill-down to affected services.
4. Add staged rollout controls with rollback shortcut.

### Frontend Quality Gates
- High-impact policy changes require explicit confirmation UI.
- Decision traces remain immutable in presentation layer.
- Access-sensitive admin actions are role-gated at UI level.

