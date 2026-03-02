# 1.6 Risk Governance Plan

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Risk & Compliance Office  
**Version:** 1.0.0  

---

## 1. Purpose
This document defines the strict governance rules preventing critical risks from actualizing into existential threats to Apex Arena. The company is built on the premise that financial integrity and legal compliance are the product, not just features.

## 2. Regulatory & Legal Risk
**Risk:** Sudden shutdown orders from state police cyber cells or the Ministry of Electronics and Information Technology (MeitY).
**Governance Policies:**
- **Automated IP Fencing:** Every login, deposit, and tournament entry evaluates the request's IP address. If it matches a banned state (blocklist provided by third-party IP intel), the action is blocked.
- **GPS Fencing Requirement:** Mobile clients must query OS location services. VPN IPs drop into a high-risk queue and are dynamically restricted from deposits.
- **KYC Residency Cross-Check:** Aadhaar extraction via HyperVerge ensures the permanent residential address is not within a banned state.

## 3. Financial Exposure Risk
**Risk:** Technical exploits allowing users to withdraw more money than they legitimately deposited or won.
**Governance Policies:**
- **Double-Entry Verification:** Withdrawals cannot execute unless the User's `TotalBalance` precisely matches the sum of all their `LedgerCredits` minus `LedgerDebits`.
- **MVP Manual Gates:** All withdrawals during the first 90 days are placed in a `Pending_Review` state. An admin must click "Approve" after visually reviewing the user's transaction history.
- **Maximum Exposure Cap:** No automated payout API call (when implemented) will exceed ₹10,000 per user per day.

## 4. Fraud & AML (Anti-Money Laundering) Risk
**Risk:** Users utilizing stolen credit cards to deposit, intentionally "losing" to a second account they control (chip-dumping), and withdrawing "clean" winning funds via UPI.
**Governance Policies:**
- **1-Account-Per-PAN:** HyperVerge PAN validation enforces strict uniqueness.
- **24-Hour Cooldown:** Withdrawals are disabled for 24 hours following any successful deposit.
- **Chip-Dumping Heuristics:** The backend monitors 1v1 matchups. If User A repeatedly loses to User B in abnormally short game times with high stakes, both accounts are frozen and flagged for AML review.
- **Closed-Loop Payouts:** Where technically feasible via Cashfree, payouts are strongly routed back to the exact bank account used for the original deposit.

## 5. Technical Collapse Risk
**Risk:** Corrupt state mutations during concurrent requests (e.g., rapid double-clicking the "Join Tournament" button).
**Governance Policies:**
- **Database Locks:** `SELECT ... FOR UPDATE` isolation locks must wrap all wallet deduction and prize distribution queries.
- **Idempotency Keys:** Every client request bridging a financial transaction must include a UUID idempotency key. The gateway drops duplicate keys within a 30-second window.

## 6. Reputation Risk
**Risk:** Widespread perception that the chess engine is generating fake opponents (bots) to drain user funds.
**Governance Policies:**
- **Provable Fairness logs:** Every chess move is recorded in PostgreSQL with cryptographically verifiable timestamps.
- **Absolute No-Bot Policy:** Under no circumstances will the platform inject "company-owned" AI players to increase liquidity. If a match is not found within 60 seconds, the search is canceled and the entry fee is unlocked.
