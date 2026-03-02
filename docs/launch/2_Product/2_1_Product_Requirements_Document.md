# 2.1 Product Requirements Document (PRD)

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Head of Product  
**Version:** 1.0.0  

---

## 1. Product Vision
To build India's premier high-stakes, 100% skill-based Chess tournament platform where the intellectual elite can securely wager and withdraw funds with absolute trust in the platform's financial and technical integrity.

## 2. Core Value Proposition
- **For the User:** A beautifully designed (crypto-dark aesthetic), lag-free chess experience with instant payouts and zero exposure to "chance" mechanics.
- **For the Business:** A highly scalable, zero-inventory escrow platform capturing 10-20% margin on millions of matched games.

## 3. High-Level Requirements

### 3.1 Authentication & Profile
- Users must be able to register via Email/Password or OTP (Future).
- **Security Capable:** Registration and Login must be protected by Cloudflare Turnstile to prevent bot-net credential stuffing.
- **Identity:** Users must have a unique, system-generated identifier for public display to prevent PII leakage on leaderboards.

### 3.2 Wallet System
- **Deposit Balance:** Funds added directly via Cashfree. Can *only* be used to enter tournaments. Cannot be withdrawn.
- **Winning Balance:** Funds awarded from tournament victories. Can be used to enter tournaments *or* withdrawn to a bank account.
- **Total Balance:** The logical sum of Deposit + Winning balances. Used only for UI display.

### 3.3 Tournament Engine
- **Formats Supported:** 1v1 Synchronous Matchmaking.
- **Parametrization:** Each tournament definition must contain: `Entry Fee`, `Prize Pool` (Entry Fee * 2 * (1 - Commission)), `Max Participants` (2 for MVP), `Start Time`.
- **Match Lifecycle:** 
  1. `Registering`
  2. `In Progress`
  3. `Completed` / `Disputed` / `Canceled`

### 3.4 Chess Gameplay Engine
- Must utilize a robust, open-source chess logic validator to confirm legal moves on the backend (preventing client-side hacking).
- Must sync game state via WebSockets for real-time play.
- Must handle disconnects gracefully (clock continues ticking; player forfeits if time expires).

## 4. Financial Compliance Requirements
- **Withdrawal Tax (TDS):** The product must calculate the user's "Net Winnings" defined as `(Total Withdrawals + Current Withdrawal) - Total Deposits`. If Net Winnings > 0, deduct 30% of the withdrawal amount automatically.
- **Age Gate:** Users must self-certify they are 18+ upon registration.
- **Geo Gate:** The frontend must block access to the deposit screen if the user's IP is located in a banned state.

## 5. Design & User Experience
- **Theme:** Deep-dark crypto aesthetic. Primary background `#0F0A1A`, heavily rounded corners, cyan and gold glowing accents for primary call-to-actions.
- **Responsiveness:** Mobile-first design for the User Frontend. Desktop-first design for the Admin Panel.
