# 1.5 Go-To-Market (GTM) Strategy

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Growth & Marketing Team  
**Version:** 1.0.0  

---

## 1. Phased Rollout Plan

To mitigate financial ruin from undiscovered economic exploits (race conditions, chip dumping), Apex Arena will launch in three heavily monitored phases.

### 1.1 Phase 1: Alpha (Friends & Family Beta) - Weeks 1-2
- **Audience:** ~500 hand-picked users.
- **Goal:** Verify Cashfree webhooks (deposits/payouts), HyperVerge KYC flows, and core Chess synchronization under live network latencies.
- **Constraints:** Maximum deposit capped at ₹500. Maximum tournament entry capped at ₹50.
- **Marketing:** Zero external marketing. Direct WhatsApp/Email invites.

### 1.2 Phase 2: Restricted Beta - Weeks 3-6
- **Audience:** ~5,000 waitlisted users acquired via initial landing page capturing.
- **Goal:** Test server concurrency, database row-locking under load, and Risk Desk operations (manual withdrawal approval times).
- **Constraints:** Maximum deposit capped at ₹5,000. All withdrawals manually reviewed (SLA < 24 hrs).
- **Marketing:** Micro-influencers in the Indian Chess community (YouTube/Instagram) sharing referral codes.

### 1.3 Phase 3: Public MVP Launch - Week 7+
- **Audience:** Target 10,000 Concurrent Users (CCU). Target 40,000 MAU within 3 months.
- **Goal:** Achieve positive unit economics and stabilize the LTV:CAC ratio.
- **Constraints:** Automated tier-1 withdrawals enabled (e.g., under ₹1000 process instantly post cooldown/fraud-check). Higher amounts remain manual.
- **Marketing:** Scaled Performance Marketing (Meta Ads, Google Ads). 

## 2. strict Geo-Targeting Rules
Advertising platforms (Meta, Google) MUST be hard-coded to **exclude** the following states to prevent regulatory backlash and wasted ad spend on users who cannot pass the KYC firewall:
- Telangana
- Andhra Pradesh
- Assam
- Odisha
- Nagaland
- Sikkim

*Any marketing agency failing to respect this blocklist will be immediately terminated due to legal exposure.*

## 3. Core Messaging Strategy
**The Hook:** "Stop trusting your money to a roll of the dice. Bet on your brain."
**Trust Signals:** 
- "Certified 100% Game of Skill"
- "Instant Withdrawals"
- "Play against real humans, never bots"
- "TDS compliant, we handle the taxes"

## 4. User Onboarding Pipeline
1. **Download & Register:** (Turnstile protected to block bots).
2. **First Deposit (Zero Friction):** Allow user to deposit *before* full KYC to reduce drop-off.
3. **Gameplay:** Play chess tournaments using Deposit Balance.
4. **The KYC Wall:** Trigger the HyperVerge Aadhaar/PAN block *only* when the user naturally decides to click "Withdraw" on their Winnings Balance. This delays friction until the user is highly motivated by the reward.
