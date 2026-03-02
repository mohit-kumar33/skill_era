# 7.3 Critical Failure Architecture & 7.4 Financial Collapse Scenarios

**Project Name:** Apex Arena (MVP)  
**Document Owner:** DevSecOps Team  
**Version:** 1.0.0  

---

## 1. Critical Failure Points Architecture
By definition, if these specific nodes fail, the platform must enter full technical paralysis (Maintenance Mode) rather than attempting to recover gracefully. Graceful degradation in fintech leads to phantom ledgers.

### 1.1 The PostgreSQL Primary Node (State: Lethal)
- **Failure:** RDS instance reboots due to hardware degradation.
- **Consequence:** Ongoing tournaments cannot settle. Cashfree webhooks fail. 
- **Required Action:** The ALB must instantly redirect `/api` traffic to a static 503 Maintenance page holding a "Database Upgrade" message. Do NOT queue webhooks in memory to execute later; let Cashfree backoff-and-retry naturally.

### 1.2 The HyperVerge API (State: Severe)
- **Failure:** KYC API throws HTTP 500s.
- **Consequence:** New users cannot withdraw. 
- **Required Action:** Disable the "Withdraw" button entirely on the frontend with a toast notification: "Partner network degraded. Retry in 1 hour."

## 2. Financial Collapse Scenarios
These are theoretical sequence of events that result in the company draining its operational capital to cover mathematically impossible user balances.

### 2.1 Scenario Alpha: The Decimal Point Leak
- **The Setup:** A tournament prize pool calculation accidentally introduces JavaScript floating point errors (e.g., `50.00000001` instead of `50.00`).
- **The Collapse:** Over 500,000 matches, the `TotalBalance` of all users mathematically exceeds the physical cash sitting in the Nodal Bank Account.
- **The Defense:** 100% Integer arithmetic using Paise (`5000` instead of `50.00`). The Midnight Reconciliation Cron Job sweeps for fractional anomalies and locks the platform if the Nodal balance < Database Wallet Sum.

### 2.2 Scenario Beta: The Reverted Deposit Phantom Win
- **The Setup:** User deposits ₹500 via UPI. Cashfree sends `SUCCESS`. User immediately plays ₹500 tournament and wins (Wallet now reads ₹900). 10 minutes later, the User's Bank unexpectedly reverses the initial UPI transaction via a delayed chargeback. Cashfree deducts ₹500 from our Nodal account.
- **The Collapse:** User withdraws ₹900. Company has functionally paid out ₹400 of its own money, completely subsidizing the fraudster.
- **The Defense:** The 24-hour Withdrawal Cooldown. UPI chargebacks typically resolve within 2-4 hours. The 24-hour lock buys the Risk Desk time to receive the Cashfree reversal alert -> ban the user account -> seize the `WinningBalance` to make the ledger whole.
