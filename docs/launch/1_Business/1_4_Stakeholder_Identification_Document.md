# 1.4 Stakeholder Identification Document

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Project Management Office  
**Version:** 1.0.0  

---

## 1. Internal Stakeholders

| Role | Responsibility | Contact / Owner | Access Level |
| :--- | :--- | :--- | :--- |
| **Executive Sponsors** | Board members/Founders providing capital. Final sign-off on Go/No-Go decisions and compliance posture. | CEO / Board | Top-Level (All Dashboards) |
| **Product & Engineering** | Developers responsible for building the Next.js frontend, Fastify backend, and PostgreSQL database logic. | CTO / Lead Eng | Source Code, AWS Prod |
| **Operations & Risk Desk** | Manual review of flagged transactions, initial KYC overrides, and manual withdrawal approvals during the MVP phase. | Risk Ops Lead | Admin Panel (Restricted) |
| **Finance / Treasury** | Reconciliation of the Cashfree Nodal Account with the internal PostgreSQL double-entry ledger. Filing Quarterly TDS (Form 26Q). | CFO / Lead Acct | Admin Panel (Financials) |

## 2. External Stakeholders (Vendors & Integrations)

| Entity | Service Provided | SLA Requirement | Escalation Risk |
| :--- | :--- | :--- | :--- |
| **Cashfree Payments** | Payment Gateway (Deposits & UPI integration). | 99.9% Uptime, <1s Callback | **CRITICAL:** Gateway revoking merchant ID due to high chargebacks kills the business. |
| **Cashfree Payouts** | Bank Transfer / IMPS / NEFT for user withdrawals. | 99.9% Uptime | **CRITICAL:** Payout delays trigger mass user distrust and legal threats. |
| **HyperVerge** | AML / KYC Identity Verification (Aadhaar/PAN). | <5s Verification time | **HIGH:** Extended downtime blocks new user onboarding and withdrawal requests. |
| **Amazon Web Services** | Cloud Infrastructure (EC2, RDS, S3) in `ap-south-1` (Mumbai). | 99.99% Uptime | **CRITICAL:** Complete platform outage if region drops. Mitigation via multi-AZ RDS. |
| **Cloudflare** | DNS, CDN, Web Application Firewall (WAF), DDoS mitigation. | 100% Edge Uptime | **HIGH:** Exposure to L7 layer attacks if circumvented. |

## 3. Regulatory & Legal Stakeholders

| Entity | Relevance | Communication Channel |
| :--- | :--- | :--- |
| **Income Tax Dept (Govt of India)** | Recipients of the 30% TDS deducted under 194BA. | Charted Accountant (CA) filing Form 26Q. |
| **MeitY / State Police Cyber Cells** | Enforcers of gambling bans in restricted states (e.g., Telangana). | Legal Counsel responding to subpoenas. |
| **Legal Counsel / Auditors** | External law firm validating our T&Cs and Skill-Game defense parameters. | Retained legal firm. |

## 4. End Users
- **The Players:** Indian residents, 18+ years of age, located in legally permitted states, holding valid PAN/Aadhaar cards linked to an active bank account matching the registered name.
