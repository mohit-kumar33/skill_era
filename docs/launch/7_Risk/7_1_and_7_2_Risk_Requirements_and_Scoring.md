# 7.1 Risk Analysis Requirements & 7.2 Risk Scoring Matrix

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Chief Risk Officer  
**Version:** 1.0.0  

---

## 1. Risk Analysis Requirements
The objective of this framework is to identify, quantify, and mitigate existential threats to the platform before they materialize. An "existential threat" is defined as any event causing >₹5,00,000 in immediate unrecoverable loss, criminal prosecution of directors, or permanent revocation of gateway access.

### 1.1 Scope of Analysis
1. **Financial Leaks:** Logic bugs allowing money creation out of thin air.
2. **Third-Party Failures:** Cashfree, HyperVerge, or AWS going dark for >1 hour.
3. **Legal Notices:** Subpoenas from hostile state cyber cells.
4. **Coordinated Fraud:** Syndicated chip-dumping rings outcompeting the manual Risk Desk.

## 2. Risk Scoring Matrix

Risks are scored on two axes: **Probability (1-5)** and **Impact (1-5)**. 
`Risk Score = Probability * Impact`. 
Any score `> 15` demands an automated technical kill switch.

| Risk Event | Probability | Impact | Score | Mitigation Engine |
| :--- | :--- | :--- | :--- | :--- |
| **Ledger Race Condition (Double Spend)** | 3 | 5 | **15** | Row-level locking on `WalletLedger` + Idempotency keys. |
| **Cashfree Webhook Forgery** | 1 | 5 | **5** | SHA-256 HMAC Signature Verification. |
| **State Cyber Cell Ban Notice** | 2 | 5 | **10** | Strict IP and HyperVerge address fencing. |
| **Coordinated Chip-Dumping Ring** | 4 | 4 | **16** | 24-hr withdrawal cooldown + Manual Payout Review (MVP only). |
| **AWS ap-south-1 Complete Outage** | 1 | 5 | **5** | Multi-AZ RDS. Users accept temporary downtime in T&Cs. |
| **Stockfish Engine Exploit (Cheating)** | 5 | 3 | **15** | Server-side centipawn loss analysis and browser-focus monitoring. |
