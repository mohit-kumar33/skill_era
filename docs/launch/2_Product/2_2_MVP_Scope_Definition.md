# 2.2 MVP Scope Definition

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Head of Product  
**Version:** 1.0.0  

---

## 1. What is the MVP?
The Minimum Viable Product (MVP) for Apex Arena is the absolute leanest version of the platform that can legally process real money, facilitate a verifiable game of chess, and allow a user to successfully withdraw their winnings.

## 2. Included in MVP (Must-Haves)

### 2.1 User Facing
- Registration & Login (Email/Password + Cloudflare Turnstile).
- User Dashboard (Wallet balances + recent transaction history).
- Tournament Listing Page (List available 1v1 chess matches with entry fees).
- Chess Game UI (Web-based board, drag-and-drop pieces, timer).
- Deposit Flow (Cashfree integration via UPI/Cards).
- Withdrawal Request Flow (Input bank details + amount).

### 2.2 Admin/Backend
- Double-entry ledger system in PostgreSQL.
- Idempotent transaction API to prevent double-charging entry fees.
- Admin Panel to view Total Users, Active Tournaments, and Pending Withdrawals.
- Manual click-to-approve withdrawal pipeline.
- Automated 30% TDS calculation query.

## 3. Excluded from MVP (Will-Not-Haves)
*These features actively distract from technical stabilization and introduce unnecessary financial/fraud risks during the critical first 90 days.*

- **Bonus Wallets / Promo Codes:** Too easily exploited by chip-dumping rings.
- **Referral Programs (MLM):** Creates perverse incentives for bots.
- **Automated Payouts via API:** All withdrawals must be manually eye-balled by the Risk Desk before initiating the Cashfree bank transfer to ensure the ledger is pristine.
- **Native iOS/Android Apps:** MVP will be a Progressive Web App (PWA) built on Next.js to bypass immediate Google Play / App Store RMG compliance reviews, which can take months.
- **Social Features:** Chat, friending, or in-game emojis are unnecessary for the core value proposition.

## 4. Release Criteria
The MVP cannot launch until:
1. The 130-scenario Red Team Security test suite passes 100%.
2. A user can register, deposit ₹100, play a game, win ₹180, and successfully request a withdrawal of ₹180 (resulting in ₹54 TDS and ₹126 transferred).
3. The database schema has been audited for deadlocks under concurrent load.
