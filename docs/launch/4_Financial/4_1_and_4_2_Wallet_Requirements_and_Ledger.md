# 4.1 Payment & Wallet Requirements & 4.2 Double-Entry Ledger Design

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Head of Finance / FinOps Engineering  
**Version:** 1.0.0  

---

## 1. Wallet Functional Requirements
The platform acts as a financial escrow. By law, user funds cannot be commingled with company operating capital until the commission is officially recognized Post-Tournament.

### 1.1 Strict Segregation of Balances
Every user has two explicit unlinked balances.
- **Deposit Balance:** Funds added directly from the user's bank. These funds have NOT been structurally won in a game of skill. Therefore, they **cannot be withdrawn**. They can only be risked in a tournament.
- **Winning Balance:** Funds that originate exclusively from a `TournamentResult` credit. These funds have been legitimized via skill gameplay. They **can be withdrawn** or risked in future tournaments.

## 2. The Double-Entry Ledger Blueprint
Traditional apps simply `UPDATE User SET balance = balance - 50`. This is catastrophic for RMG. If the database crashes mid-update, the ₹50 vanishes without a trace.

Apex Arena uses an append-only **WalletLedger** table. The formula `Sigma(Credits) - Sigma(Debits) == TotalBalance` must resolve to `True` at all milliseconds.

### 2.1 Ledger Transaction: User Deposits ₹100
1. `Transaction` table inserted: `INITIATED` | Amount: `10000` (Paise)
2. Cashfree Webhook -> `SUCCESS`
3. Data Mutated within Postgres `Serializable` Transaction:
   - `WalletLedger` Insert: `Credit`, `+10000`, Type: `DEPOSIT`
   - `User` Update: `depositBalance += 10000`

### 2.2 Ledger Transaction: User Enters ₹50 Tournament
1. Data Mutated within Postgres `Serializable` Transaction:
   - `WalletLedger` Insert: `Debit`, `-5000`, Type: `DEPOSIT` *(Assuming user only had deposit balance)*
   - `User` Update: `depositBalance -= 5000`

### 2.3 Ledger Transaction: User Wins Tournament (Prize: ₹85)
1. Match confirms Checkmate.
2. Data Mutated within Postgres `Serializable` Transaction:
   - `WalletLedger` Insert: `Credit`, `+8500`, Type: `WINNING`
   - `User` Update: `winningBalance += 8500`

### 2.4 Fractional Paise Discard Policy
If a commission rate results in a fractional Paise (e.g., ₹0.005), the platform algorithm MUST mathematically `Math.floor()` the prize pool and `Math.ceil()` the commission. The company absorbs the positive fraction to ensure the system never creates phantom liquidity.
