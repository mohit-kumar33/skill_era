# Treasury Reserve Policy

## Purpose
To ensure skill era maintains sufficient liquidity to honor all user withdrawal requests instantly, safeguarding player funds against operational risks or insolvency.

## Reserve Requirement
1. **1:1 Pegging:** Skill Era must maintain a 1:1 liquid reserve ratio for all user balances.
   - For every ₹1 in user `deposit_balance` or `winning_balance`, there must be ₹1 held in the designated platform settlement accounts.
2. **Segregation:** Player funds must be kept strictly segregated from the company's operational accounts. Player funds cannot be used to pay operational expenses (e.g., salaries, marketing, hosting).

## Reconciliation Frequency
- **Automated Nightly:** The `reconciliation.service.ts` runs automatically at midnight, matching the sum of all wallet balances against the total balances reported by the payment gateways (Razorpay/Cashfree).
- **Manual Weekly:** Finance admins review the automated reconciliation reports and verify against actual bank statements every Monday.

## Alerting Thresholds
- **Deviation Alert:** Any discrepancy greater than ₹500 between the ledger total and gateway total triggers an immediate SEV-2 alert to the finance team.
- **Low Liquidity Alert:** If the connected payout account balance falls below 120% of the average daily withdrawal volume, an alert is sent to deposit additional operational collateral.

## Liability & Coverage
- The platform covers payment gateway processing fees and any chargebacks out of operational margins, NOT out of the user reserve pool.
- The reserve must only decrease when verified, user-initiated withdrawals are successfully disbursed.
