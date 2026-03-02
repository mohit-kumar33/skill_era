# 7.5 Fraud Abuse Scenarios & 7.6 Operational Breakdown

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Risk Operations Manager  
**Version:** 1.0.0  

---

## 1. Fraud Abuse Scenarios

Fraud in skill-RMG is rarely about hacking databases; it is about social engineering and exploiting the rules of reality.

### 1.1 Scenario A: The Syndicate Chip Dump
- **Execution:** A criminal ring uses stolen credit cards to fund 10 "Dummy" accounts. They use 1 "Clean" account verified with a valid Aadhaar/PAN. In the middle of the night, when lobby liquidity is low, the Dummy accounts matchmake against the Clean account and intentionally surrender on Move 3.
- **Result:** The stolen ₹50,000 is funneled into the Clean account's `WinningBalance`, ready for withdrawal via clean UPI.
- **Defense System:** 
  1. Minimum game duration limits. A win occurring in < 15 seconds triggers a mandatory manual review hold on the funds. 
  2. Velocity rules: A single account winning 10 consecutive matches against brand-new accounts triggers an AML freeze.

### 1.2 Scenario B: The Shared Wi-Fi Farm
- **Execution:** Operations running 50 mobile phones from a single room trying to coordinate matchups.
- **Defense System:** The matchmaking backend queries the `x-forwarded-for` IP header. Users holding the exact same public IP address cannot be placed in the same tournament under any circumstances.

## 2. Operational Breakdown Scenarios

### 2.1 The VIP Support Backlog
- **Event:** A Cashfree NEFT gateway fails on a Friday afternoon. 5,000 user withdrawals get stuck in a "Processing" state.
- **Consequence:** Users panic, assuming the platform is a scam. Support email queue hits 10,000+. The Play Store app gets review-bombed to 1.1 stars.
- **SOP (Standard Operating Procedure):**
  1. Instant globally broadcasted UI Banner: "Banking partner facing delays. Funds are 100% safe. ETA: Monday."
  2. Disable the "Withdraw" button to stop compounding the queue.

### 2.2 The Risk Desk Bottleneck
- **Event:** The platform goes viral. The queue of manual withdrawals waiting for Risk Desk approval hits 2,000. 
- **Consequence:** The 24-hour SLA is breached. Users grow hostile.
- **SOP:** Activate the Tier-1 Auto-Approve circuit breaker. Any withdrawal under ₹500 from an account older than 7 days utilizing a previously verified Withdrawal Bank Account is auto-approved via API without human intervention. Analyst focus shifts entirely to payouts > ₹5,000.
