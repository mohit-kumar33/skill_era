# 8.5 Monitoring & Logging Plan & 8.6 Disaster Recovery (DR) Plan

**Project Name:** Apex Arena (MVP)  
**Document Owner:** SRE (Site Reliability Engineering) Team  
**Version:** 1.0.0  

---

## 1. Monitoring & Logging Plan
"You cannot fix what you cannot see." 

### 1.1 Centralized Logging (ELK / CloudWatch)
Every microservice/container writes structured JSON logs to standard output. These are ingested by AWS CloudWatch.
- **Financial Logs:** Every ledger interaction is logged at the `INFO` level.
- **Pino Logger:** Fastify utilizes Pino for high-speed, non-blocking asynchronous JSON logging to prevent disk I/O from slowing down API responses.
- **Scrubbing:** Absolutely NO Passwords, PAN numbers, or JWTs are ever written to stdout. The logger automatically strips keys matching `['password', 'token', 'pan']`.

### 1.2 APM (Application Performance Monitoring)
Tools like Datadog or New Relic are integrated to provide distributed tracing.
- If the `/api/wallet/withdraw` endpoint suddenly starts taking `2000ms` instead of `200ms`, the APM will visually trace the delay to either the PostgreSQL query taking too long or the Cashfree API lagging.

### 1.3 Alerting Subsystem (PagerDuty)
Critical anomalies trigger PagerDuty calls directly to engineers' cell phones 24/7.
- **Trigger 1:** PostgreSQL DB CPU > 90% for 5 minutes.
- **Trigger 2:** More than 5 Cashfree webhooks fail HMAC validation in 1 minute (Brute force signature attack).
- **Trigger 3:** 500 error rate exceeds 1% of total traffic.

## 2. Disaster Recovery (DR) Plan
This defines the protocol when the absolute worst-case scenario occurs (e.g., AWS Region Mumbai completely goes offline due to a natural disaster).

### 2.1 Crucial Metrics
- **RPO (Recovery Point Objective):** The maximum amount of data loss acceptable. **Target: < 5 Minutes.**
  - *Mechanism:* AWS RDS continuously archives WAL (Write-Ahead Logs) to S3 every 5 minutes. We can never lose more than 5 minutes of wallet history.
- **RTO (Recovery Time Objective):** The maximum time allowed to bring the entire platform back online in a new region. **Target: < 2 Hours.**

### 2.2 The Cross-Region DR Execution
If AWS `ap-south-1` (Mumbai) goes dark:
1. **Declare Disaster:** CTO initiates the Terrafrom DR script manually.
2. **Infrastructure Spin-up:** Terraform automatically builds the VPC, subnets, EC2 clusters, and load balancers in `ap-southeast-1` (Singapore) region.
3. **Database Restoration:** The most recent backup snapshot from AWS S3 is restored into a fresh PostgreSQL instance in Singapore.
4. **Traffic Reroute:** Cloudflare DNS is pointed to the new Singapore ALB.
5. **Reconciliation:** All matches active during the precise minute of the blackout are marked as `CANCELED` via an emergency DB script, and entry fees are credited back to user ledgers based on the 5-minute RPO snapshot.
