# 8.3 Reliability Requirements & 8.4 Availability Targets

**Project Name:** Apex Arena (MVP)  
**Document Owner:** DevOps Lead  
**Version:** 1.0.0  

---

## 1. Reliability Requirements
"Reliability" measures the platform's ability to maintain data integrity when things break.

### 1.1 Ledger Reliability Guarantee
If an AWS EC2 instance physically catches fire the exact millisecond a user clicks "Pay", the database MUST guarantee that funds were either 100% deducted or 100% untouched. There can be no "Partial" deductions.
- **Mechanism:** Strict usage of ACID transactions. `prisma.$transaction()` wraps every ledger mutation. If the Node.js process dies before the `Commit` executes, PostgreSQL automatically issues a `Rollback`.

### 1.2 Idempotent Retries
Due to mobile network instability (common in Tier-2 Indian cities), the client app is programmed to retry failed API calls. 
- **Guarantee:** The backend guarantees that receiving the identical payload 10 times will only result in 1 database mutation (managed via the UUID `X-Idempotency-Key` header).

## 2. Availability Targets (Uptime SLAs)
Due to the financial nature of the app, downtime directly equates to lost commission and severe brand damage.

### 2.1 The "Four Nines" Target (99.99%)
We target 99.99% availability for the Edge routing and Static frontend.
We target 99.9% availability for the relational Database.

| Component | Target Uptime | Max Permitted Downtime / Month |
| :--- | :--- | :--- |
| **Cloudflare DNS/WAF** | 100% | 0 minutes |
| **Next.js Frontend (Static)** | 99.99% | 4.38 minutes |
| **Fastify API & WebSockets**| 99.95% | 21.9 minutes (Rolling deployments) |
| **PostgreSQL RDS** | 99.9% | 43.8 minutes (Maintenance windows) |

### 2.2 Scheduled Maintenance
Because the platform is globally available but specifically targets India, any scheduled downtime required for major PostgreSQL engine version upgrades will occur strictly between **03:00 AM and 05:00 AM IST** on a Tuesday (statistically the lowest liquidity period). Users will receive an in-app banner warning 48 hours prior.
