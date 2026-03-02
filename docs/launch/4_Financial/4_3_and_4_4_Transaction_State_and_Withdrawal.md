# 4.3 Transaction State Machine & 4.4 Withdrawal Approval Flow

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Risk Operations Manager  
**Version:** 1.0.0  

---

## 1. Cashfree Transaction State Matrices

Every communication with the payment gateway maps to a strict internal State Enum to prevent race conditions during webhook duplications.

### 1.1 Deposit States
| Status | Definition | Allowed Transitions |
| :--- | :--- | :--- |
| `PENDING` | User requested checkout URL. No money moved. | `SUCCESS`, `FAILED` |
| `SUCCESS` | Gateway confirmed money collected. Ledger credited. | *Terminal* |
| `FAILED` | User canceled UPI or bank rejected. Ledger untouched. | *Terminal* |

**Critcal Idempotency Note:** If Cashfree sends the `SUCCESS` webhook twice due to network retries, the database query checks `WHERE transaction.status === 'PENDING'`. The second webhook will hit a `transaction.status === 'SUCCESS'` check and be legally dropped, preventing double-crediting the user.

## 2. The Withdrawal Approval Pipeline

During the MVP Phase (Months 1-3), **automated API payouts are strictly disabled**. Every single withdrawal mathematically reduces the company's liability, making it the most targeted vector for fraud.

### 2.1 The Extraction Trigger
1. User requests ₹500 withdrawal from their Winning Balance.
2. The Database evaluates four mandatory gates:
   - **Gate 1:** `User.kycStatus === 'VERIFIED'`
   - **Gate 2:** `CurrentTimestamp > (LastDepositTimestamp + 24 Hours)`
   - **Gate 3:** `User.winningBalance >= 500`
   - **Gate 4:** `TDS_Calculation_Module` verifies the remaining balance covers the 30% tax liability if Net Winnings > 0.

### 2.2 The 'Hold' Mechanism
If all 4 gates pass, the requested funds (e.g., ₹500) are immediately `DEBITED` from the user's `WinningBalance` and moved into a shadow state. 
- A `Transaction` is created as `PENDING_REVIEW`.
- *Why?* To prevent the user from taking that reserved ₹500 and playing a chess match with it while the Admin is reviewing the withdrawal.

### 2.3 The Manual Risk Review (Admin Dashboard)
A human Risk Analyst logs into the MVP Admin Panel and views the withdrawal queue.
The Analyst checks the user's gameplay history for "Chip Dumping" (e.g., User A depositing, deliberately losing to User B in 3 moves, and User B withdrawing the "clean" money).

**Analyst Actions:**
- **APPROVE:** Analyst clicks button -> Fastify triggers Cashfree Payouts API. Monies sent. Status -> `SUCCESS`.
- **REJECT:** Analyst clicks button -> Fastify triggers Ledger Reversal. Funds returned to User's `WinningBalance`. Status -> `REVERTED`.
- **FLAG:** User account is suspended pending KYC video verification.
