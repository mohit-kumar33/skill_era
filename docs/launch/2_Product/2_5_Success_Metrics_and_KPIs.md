# 2.5 Success Metrics & KPIs

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Data & Strategy Team  
**Version:** 1.0.0  

---

## 1. The North Star Metric
**Matches Played Per Daily Active User (DAU)**  
*Rationale: The platform only makes money via commission on matched games. A user storing money in the wallet without playing generates zero revenue and actually costs money via AWS storage and compliance overhead.*

## 2. Financial Metrics (Company Health)

| Metric | Definition | Target (MVP) | Danger Threshold |
| :--- | :--- | :--- | :--- |
| **ARPPU** | Average Revenue Per Paying User (Commission only). | > ₹300 / mo | < ₹100 / mo |
| **CAC** | Customer Acquisition Cost (Marketing spend / new depositing users). | < ₹80 | > ₹150 |
| **LTV : CAC** | Lifetime Value divided by CAC. | > 3.0x | < 1.5x |
| **Chargeback Rate** | Percentage of deposited funds disputed via credit card/UPI. | < 0.25% | > 1.0% (Gateway Ban Risk) |

## 3. Product & Engagement Metrics

| Metric | Definition | Target (MVP) | Danger Threshold |
| :--- | :--- | :--- | :--- |
| **D1 Retention** | Users returning on Day 1 after registration. | > 40% | < 20% |
| **D7 Retention** | Users returning on Day 7 after registration. | > 20% | < 10% |
| **Deposit Conversion** | Percentage of registered users who make a first deposit. | > 15% | < 5% |
| **Matchmaking SLA** | Time taken from clicking "Join" to game starting. | < 15 seconds | > 60 seconds (High Bounce) |

## 4. Operational & Risk Metrics

| Metric | Definition | Target (MVP) | Danger Threshold |
| :--- | :--- | :--- | :--- |
| **KYC Pass Rate** | Percentage of users initiating HyperVerge who successfully pass. | > 85% | < 60% (Friction issue) |
| **Payout SLA** | Time from user requesting withdrawal to money in bank. | < 24 Hours | > 72 Hours (Twitter backlash) |
| **Fraud Flagging Rate**| Percentage of match results flagged for suspicious bot-like timing. | < 2.0% | > 5.0% (Engine compromised) |

## 5. System Health Metrics

| Metric | Definition | Target (MVP) | Danger Threshold |
| :--- | :--- | :--- | :--- |
| **API Availability** | Uptime of the primary Node.js backend. | 99.99% | < 99.9% |
| **DB Query Latency**| p95 latency for PostgreSQL wallet ledger updates. | < 50ms | > 200ms (Race conditions) |
| **WebSocket Droprate**| Percentage of chess games failing due to persistent disconnections. | < 1.0% | > 3.0% |
