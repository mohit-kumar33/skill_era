# 3.2 Low-Level Design (LLD)

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Lead Backend Engineer  
**Version:** 1.0.0  

---

## 1. System State Machines

To prevent logical bugs yielding financial loss, the two most critical domains (Tournaments and Transactions) operate strictly via predefined State Machines. 

### 1.1 The Tournament State Machine
| State | Trigger | Next State | Condition |
| :--- | :--- | :--- | :--- |
| `REGISTERING` | Admin creates match. | `IN_PROGRESS` | Player 1 and Player 2 successfully join, and both pay entry fees. |
| `IN_PROGRESS` | Both players sit. | `COMPLETED` | King is checkmated, or clock hits 0:00. |
| `COMPLETED` | Match logic resolves. | *Terminal* | Payouts are dispatched to winner. |
| `CANCELED` | P2 fails to join within 5 mins, or server crash. | *Terminal* | Entry fees refunded strictly to original wallets. |

### 1.2 The Transaction State Machine
| State | Trigger | Ledger Action |
| :--- | :--- | :--- |
| `INITIATED` | User requests deposit/withdrawal. | None |
| `PENDING` | API call sent to gateway. | Hold placed on wallet (for withdrawals). |
| `SUCCESS` | Gateway Webhook received. | Wallet mutated strictly. |
| `FAILED` | Gateway Webhook received (Fail). | Hold released. |
| `REFUNDED` | Admin manually reverts. | Reverse operation applied. |

## 2. Double-Entry Ledger Logic

The `Wallet` table has three conceptual columns: `DepositBalance`, `WinningBalance`, and `TotalBalance`.
Instead of just incrementing these values (which obscures the history and makes audits impossible), every mutation is coupled with a `Ledger` row.

**Formula Check before any Withdrawal approval:**
`TotalBalance` **MUST EXACTLY EQUAL** `SUM(Ledger Credits) - SUM(Ledger Debits)`.
If a background chron job detects a discrepancy of even ₹0.01 between the materialized `TotalBalance` and the aggregate Ledger calculation, the user's account is instantly locked for "Ledger Inconsistency".

## 3. Concurrency & Locking Strategy

In an environment where a user might double-tap a screen, race conditions are lethal.

### Scenario: Double-Tapping "Join Tournament"
- Player has `₹50`. 
- Taps "Join ₹50 Tournament" twice in 10ms.
- Two threads reach the backend. Both check `balance >= 50`. Both say YES. Both deduct `50`. Player balance becomes `-₹50` (Platform loses money).

### LLD Solution: Row-Level Locking
```typescript
// Prisma Implementation mapping to PostgreSQL SELECT ... FOR UPDATE
await prisma.$transaction(async (tx) => {
  // 1. Lock the user row directly
  const user = await tx.$queryRaw`SELECT * FROM "User" WHERE id = ${userId} FOR UPDATE`;
  
  // 2. Evaluate balance only AFTER securing the lock
  if (user.winningBalance + user.depositBalance < 50) {
    throw new Error('Insufficient funds');
  }

  // 3. Mutate and commit (Release lock)
  // ... deduction logic
});
```
*Note: We lock the row, not the table, ensuring other users' actions remain performant.*

## 4. Encryption & Hashing
- **Passwords:** Bcrypt (Cost Factor 12).
- **Session Tokens:** JWT (Signed via HMAC SHA-256). Short-lived (15 mins) + HTTP-Only Refresh Cookies (7 days).
- **Database:** RDS Storage is encrypted at rest using AWS KMS. Network transit is TLS 1.3 enforced.
