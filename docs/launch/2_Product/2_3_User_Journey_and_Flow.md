# 2.3 User Journey & Flow Documentation

**Project Name:** Apex Arena (MVP)  
**Document Owner:** UX/UI Design & Product Team  
**Version:** 1.0.0  

---

## 1. Account Creation & Onboarding
**Goal:** Frictionless entry to get the user viewing tournaments.

1. **Landing:** User arrives at `apexarena.in`. 
2. **Action:** Clicks "Register".
3. **Input:** Email, Password, Accepts T&Cs (18+ & Geo-location).
4. **Validation:** Turnstile validates human. Backend validates unique email.
5. **Result:** User is redirected to `/dashboard`. Wallet balances are initialized to `₹0`.

## 2. First Deposit Loop
**Goal:** Convert free user to monetary participant quickly.

1. **Trigger:** User clicks prominent Gold "Contribute/Deposit" Button on dashboard.
2. **Input:** User enters `₹500` and clicks "Pay with UPI".
3. **Backend:** Creates `Transaction` record as `PENDING`. Calls Cashfree API to generate session checkout URL.
4. **Action:** User fulfills payment on Cashfree gateway (PhonePe/GPay).
5. **Webhook:** Cashfree hits `/api/webhooks/cashfree`. Backend verifies signature.
6. **Ledger:** Backend executes atomic credit: `DepositBalance += 500`. Transaction marked `SUCCESS`.
7. **Result:** User redirected back to Dashboard with celebratory UI.

## 3. Tournament Participation Flow
**Goal:** Safe escrow of funds and match creation.

1. **Trigger:** User views `/tournaments` list. Clicks "Join" on a ₹50 Entry Fee match.
2. **Validation:** 
    - Does `TotalBalance >= 50`? (Prioritize deducting WinningBalance first, then DepositBalance).
3. **Ledger:** Backend creates pending deduction (`Entry_Fee`).
4. **Lobby:** User waits in lobby until Player 2 joins.
5. **Match Start:** 
    - Deductions are finalized on both ledgers.
    - WebSockets connect. Match begins.
6. **Conclusive End:** Player 1 Checkmates Player 2.
7. **Settlement:** 
    - Platform calculates `$50 + $50 = $100`. 
    - Commission `15%` = `$15` retained in treasury.
    - Winner Prize `$85`.
    - Backend executes atomic credit to Player 1: `WinningBalance += 85`.

## 4. KYC & Withdrawal Loop
**Goal:** Compliant, secure extraction of funds.

1. **Trigger:** Player 1 clicks "Withdraw" to extract their `₹85`.
2. **Gateways:**
    - Is Withdrawal Cooldown active? (Block if < 24 hrs since last deposit).
    - Is KYC complete? (If False -> Redirect to HyperVerge Aadhaar/PAN flow).
3. **Input:** User selects amount (`₹85`) and enters Bank Account / IFSC.
4. **Calculation:**
    - Net Winnings = `85`.
    - TDS (30%) = `25.5`.
    - Payable Amount = `59.5`.
5. **Ledger:** Backend deducts `85` from `WinningBalance`. Creates `Withdrawal_Request` for `59.5` and `TDS_Record` for `25.5`.
6. **Operations:** Request appears in Admin Panel Queue.
7. **Admin Action:** Risk desk verifies no chip-dumping occurred. Clicks "Approve".
8. **Payout:** Backend calls Cashfree Payouts API. Monies hit User's Bank Account. Transaction marked `PAID`.
