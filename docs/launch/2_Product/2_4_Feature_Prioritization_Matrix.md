# 2.4 Feature Prioritization Matrix

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Head of Product  
**Version:** 1.0.0  

---

## 1. Prioritization Framework (MoSCoW)
To ensure the MVP sequence is protected from scope creep, features are strictly categorized into Must Haves (P0), Should Haves (P1), Could Haves (P2), and Won't Haves (P3).

## 2. The Matrix

| Feature | Category | Priority | Rationale / Dependency |
| :--- | :--- | :--- | :--- |
| **Cashfree Deposits Integration** | Wallet | P0 (Must Have) | Critical path. If users cannot fund wallets, the platform fails. |
| **Cashfree Payouts Integration** | Wallet | P0 (Must Have) | Critical path. If users cannot withdraw, it constitutes fraud. |
| **HyperVerge KYC (Aadhaar/PAN)** | Compliance | P0 (Must Have) | Legal requirement to ensure 18+ and non-banned state residency. |
| **Geo-IP Blocking (Banned States)** | Compliance | P0 (Must Have) | Existential legal risk to operate without it. |
| **Manual Withdrawal Admin Approval** | Risk | P0 (Must Have) | Mandatory to prevent early-stage payout exploits or logic bugs draining capital. |
| **30% TDS Calculator Module** | Finance | P0 (Must Have) | Mandatory Government of India tax compliance feature. |
| **Core 1v1 Chess Sync Engine** | Gameplay | P0 (Must Have) | The core product offering. |
| **Turnstile CAPTCHA** | Security | P0 (Must Have) | Stops bot-net creation from overwhelming the Postgres DB. |
| **Automated Payouts (< ₹1000)** | Operations | P1 (Should Have) | Reduces Risk Desk overhead, but can wait until Week 4 to ensure ledger stability. |
| **Email/SMS Receipts** | User Exp. | P1 (Should Have) | Essential for building trust, but secondary to core mechanics. |
| **Global Leaderboard** | User Exp. | P1 (Should Have) | Drives retention and competition, but not strictly needed for Week 1. |
| **Elo Rating System** | Gameplay | P2 (Could Have) | Nice to have for fairer matchmaking, but initial MVP can use blind matchmaking to guarantee liquidity. |
| **Referral Program (MLM)** | Growth | P3 (Won't Have) | Dangerous during MVP. Highly susceptible to bot abuse and fake KYC fraud rings. |
| **Promotional Bonus Wallets** | Finance | P3 (Won't Have) | Complicates taxation and ledger integrity. Users will deposit real money or not play. |

## 3. Sprint Sequencing
- **Sprint 1-2:** P0 Infrastructure, Database Schemas, Basic Auth, Geo-blocking.
- **Sprint 3-4:** P0 Cashfree Deposits, Core Chess Engine, Basic Wallet Ledger.
- **Sprint 5-6:** P0 HyperVerge KYC, Cashfree Payouts, TDS Logic, Admin Panel built.
- **Sprint 7 (Hardening):** Multi-tenant load testing, Red Team security audits, UAT.
