# 4.7 Refund Policy Logic & 4.8 Treasury Strategy

**Project Name:** Apex Arena (MVP)  
**Document Owner:** CFO / Legal Counsel  
**Version:** 1.0.0  

---

## 1. Refund & Cancellation Mechanics

Under no circumstances will the platform "refund" an entry fee if a player simply blunders their queen and loses a chess match. Refunds are strictly localized to technical faults.

### 1.1 Deposit Refunds (Pre-Gameplay)
If a user deposits ₹500 but their wallet is not credited due to a webhook failure, they may submit a support ticket.
- **Action:** If the `Reconciliation Service` verifies the funds were captured by the Nodal account but uncredited, the system forces a Cashfree Gateway Refund. The funds return to the user's UPI app. 

### 1.2 Tournament Cancellation Refunds
- **Scenario A (Opponent No-Show):** If Player 1 joins a lobby and Player 2 does not join within 300 seconds, the tournament is `CANCELED`. The entry fee is automatically credited back to Player 1's ledger.
- **Scenario B (Server Crash):** If the WebSocket server restarts mid-match, the Stockfish engine loses state. The match is `CANCELED`. Both players receive their entry fees back in full. No commission is charged.

## 2. Treasury Management Strategy

The Treasury strategy dictates how the company handles the physical cash sitting in the banking ecosystem.

### 2.1 The Tri-Account Structure
1. **The Gateway Nodal Account (Cashfree):** Where user deposits land. Strictly read-only to the company. Cannot be used to pay employee salaries.
2. **The TDS Tax Account (Internal Axis/HDFC):** Every time a user withdraws and 30% TDS is deducted, the company must physically move that 30% from the Nodal Account into this Tax Account, preparing for the quarterly Government payout.
3. **The OpEx Account (Internal Axis/HDFC):** Every week, the accumulated `Platform_Revenue` (Commission) is extracted from the Nodal Account and wired to the Operations account to pay for AWS, Cashfree Gateway fees, and payroll.

### 2.2 TDS Liquidity Management
Because 30% TDS is deducted on *Net Winnings*, the company acts as a massive tax collection agent. Failure to have the exact right amount of cash in the Tax Account on the day the Form 26Q filing is due results in severe corporate penalties. This requires the `Reconciliation Service` to not just track user funds, but explicitly aggregate daily Tax Liabilities.
