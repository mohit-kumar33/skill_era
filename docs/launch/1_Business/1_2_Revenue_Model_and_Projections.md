# 1.2 Revenue Model & Financial Projections

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Finance & Strategy Team  
**Version:** 1.0.0  

---

## 1. Primary Revenue Stream: Platform Commission (Rake)
The sole operating revenue for the MVP phase is the platform commission deducted from the total entry pool of peer-to-peer tournaments.

**The Mechanics:**
- Player A pays ₹50 entry fee.
- Player B pays ₹50 entry fee.
- Total Tournament Pool: ₹100.
- Platform Commission (e.g., 15%): ₹15.
- Winner Prize Pool: ₹85.
- Loser Prize: ₹0.

**Rationale:**
By not taking positional risk against the players, the platform operates purely as an escrow and matchmaking facilitator. This drastically reduces financial risk and solidifies the legal definition of a technology provider rather than a gambling "house."

## 2. Unit Economics (Per Match)

| Metric | Scenario A (Low Stakes) | Scenario B (Mid Stakes) |
| :--- | :--- | :--- |
| Entry Fee per Player | ₹20 | ₹500 |
| Total Pool | ₹40 | ₹1,000 |
| Commission Rate | 20% | 10% |
| **Gross Revenue (Platform)** | **₹8.00** | **₹100.00** |
| Gateway Cost (Deposit 1.5%) | ₹0.60 | ₹15.00 |
| Server/Operational Cost (Est) | ₹0.50 | ₹1.00 |
| **Net Contribution Margin** | **₹6.90** | **₹84.00** |

*Note: Commission margins scale inversely with tournament stakes to incentivize high-roller liquidity.*

## 3. Financial Projections (MVP to Year 3)

### 3.1 Assumptions
- **Average Revenue Per Paying User (ARPPU):** ₹300 / month
- **Customer Acquisition Cost (CAC):** ₹80 (Performance Marketing)
- **Monthly Churn Rate:** 15%

### 3.2 Projected Trajectory

| Phase | Target CCU | Monthly Active Users (MAU) | Estimated Monthly Gross Revenue |
| :--- | :--- | :--- | :--- |
| **MVP (Launch-Month 3)** | 10,000 | 40,000 | ₹1.2 Crore ($145k) |
| **Year 1** | 50,000 | 250,000 | ₹7.5 Crore ($900k) |
| **Year 2** | 100,000 | 600,000 | ₹18 Crore ($2.1m) |
| **Year 3** | 500,000+ | 2,500,000+ | ₹75 Crore ($9m+) |

## 4. Treasury & Cash Flow Management
Because the platform acts as an escrow, maintaining a pristine ratio between liabilities (user funds) and operational cash is paramount.

### 4.1 Legal Liability Ring-fencing
- **Escrow Account Segregation:** User deposited funds and winning balances MUST be parked in an entirely separate nodal/escrow bank account.
- **Operational Account:** Platform commissions are transferred daily/weekly batch from the nodal account to the operational account to pay for AWS, Cashfree, and staff.

### 4.2 Taxation Impact on Cash Flow
- **TDS (30% on Net Winnings):** The platform deducts TDS upon withdrawal. These funds do NOT belong to the platform. They are a liability owed to the Government of India (Income Tax Department).
- **GST (28% on Face Value):** Under recent Indian GST council rules for RMG, 28% GST is applicable on the *initial deposit amount*, not the commission. 
  - *Mitigation Plan:* The platform absorbs the GST initially to encourage user acquisition, meaning a ₹100 deposit results in ₹100 playable balance, but the company owes ₹28 to the state. This severely impacts CAC and necessitates high-retention gameplay.

## 5. Non-Revenue Constraints
- **Zero Fractional Payouts:** To avoid floating-point math errors leading to systemic ledger leakage over millions of rows, all monetary values in the database must be stored in the smallest unit (Paise) as integers. 
- **No Credit:** Users cannot borrow funds against future winnings. No leverage is permitted.
