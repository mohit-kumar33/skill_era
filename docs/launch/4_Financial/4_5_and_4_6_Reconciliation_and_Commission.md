# 4.5 Reconciliation Process & 4.6 Commission Logic

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Head of Accounting  
**Version:** 1.0.0  

---

## 1. Automated Nodal Reconciliation (T+1)

The platform's internal PostgreSQL database represents what we *think* happened. The Cashfree Nodal Account represents what *actually* happened. If these diverge, the company is severely liable.

### 1.1 The Midnight Cron Job
At 00:00 IST daily, the platform executes the `Reconciliation Service`:
1. **Fetch:** Pulls the official Settlement Report via Cashfree API for the previous day.
2. **Compare:** Matches every `cf_order_id` in the Cashfree T+1 settlement batch against the `Transaction` table in Postgres where `status = SUCCESS`.
3. **Analyze:**
   - Detects **Missing Credits:** Cashfree says User paid, but Postgres shows `PENDING` (webhook failed). Platform automatically credits user and pages DevOps.
   - Detects **Phantom Credits:** Postgres shows `SUCCESS`, but Cashfree shows `FAILED`. (Massive security breach). Halts all payouts platform-wide instantly.

## 2. Dynamic Commission (Rake) Handling Logic

Apex Arena does not charge a flat fee. Commission is structured progressively to inject liquidity into higher-stakes games while maximizing margin on low-stakes volume.

### 2.1 Commission Tiering
| Entry Fee Tier | Commission % (Rake) | Prize Pool Return % |
| :--- | :--- | :--- |
| ₹20 - ₹99 | 15% | 85% |
| ₹100 - ₹499 | 12% | 88% |
| ₹500+ | 10% | 90% |

### 2.2 Financial Materialization of Rake
The commission is NOT extracted dynamically during gameplay. It is extracted structurally during the settlement phase.
- **Pre-game:** Both users pay ₹500 (Total Pool: ₹1000). Both have `-₹500` debits in their ledger.
- **Post-game:** Winner is declared. Platform calculates Prize (Tier ₹500 = 10% commission = ₹100 company revenue. ₹900 to Winner).
- **Settlement:** Winner ledger is credited `+₹900`. 
- **Accounting Note:** The remaining ₹100 never enters a user's ledger. It is logged as `Platform_Revenue` in an aggregated metrics table for the CFO dashboard.
