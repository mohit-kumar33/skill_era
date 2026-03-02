# Incident Response Plan

## Overview
This document outlines the procedures for responding to security incidents, service outages, and financial anomalies on the Skill Era platform.

## Severity Levels

| Level | Description | Example | Response SLA |
|-------|-------------|---------|--------------|
| **SEV-1** | Critical platform outage or active financial exploit | Payment gateway down, negative balance exploit | 15 mins |
| **SEV-2** | Subsystem degraded or compliance violation | KYC provider down, high fraud flags | 1 hour |
| **SEV-3** | Non-critical bug, degraded performance | UI glitch, slow tournament joins | 24 hours |

## Response Workflow

### 1. Detection & Triage
- Alerts route to PagerDuty (`#alerts-critical` Slack channel).
- On-call engineer acknowledges within SLA.
- Identify severity and scope.

### 2. Containment
- **Financial exploits:** Immediately pause payouts via admin panel toggle (`POST /admin/payouts/pause`).
- **Data breaches:** Revoke compromised credentials, force session expirations.
- **DDoS:** Enable Cloudflare Under Attack mode.

### 3. Mitigation & Eradication
- Roll back recent deployments if caused by a bad release.
- Apply hotfixes for identified vulnerabilities.
- Block malicious IPs/Users via `POST /admin/users/:id/ban`.

### 4. Recovery
- Verify system stability.
- Re-enable paused services carefully.
- Reconcile lost or incorrectly disbursed funds.

### 5. Post-Mortem
- Write an incident report within 48 hours for SEV-1 and SEV-2.
- Identify root cause and implementation gaps.
- Schedule remediation tasks.
