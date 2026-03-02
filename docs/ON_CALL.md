# On-Call Escalation Policy

## Purpose
Ensure rapid response to platform incidents outside of normal business hours and establish a clear chain of command for critical issues.

## Primary On-Call Roster
- The primary on-call engineer rotates weekly, starting Mondays at 10:00 AM IST.
- The schedule is maintained in PagerDuty.

## Escalation Path
All high-severity alerts (SEV-1/SEV-2) follow this path automatically if unacknowledged:

1. **Level 1 (Immediate):** Primary On-Call Engineer (SMS & Phone Call)
2. **Level 2 (+15 mins):** Secondary On-Call Engineer (SMS & Phone Call)
3. **Level 3 (+30 mins):** Engineering Manager (Phone Call)
4. **Level 4 (+45 mins):** CTO / Executive Team (Phone Call)

## Responsibilities of On-Call
- Acknowledge alerts within the 15-minute SLA.
- Perform initial triage and determine the severity.
- If it's a SEV-1 (e.g., financial exploit), the engineer is authorized to use the "Emergency Stop" admin toggles (e.g., pausing all payouts, halting tournament joins).
- Coordinate with the secondary engineer if additional help is needed.
- Write the post-mortem document for the incident.
