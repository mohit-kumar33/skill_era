# 6.3 AML/KYC Policy, 6.4 Privacy Plan & 6.5 Responsible Gaming

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Risk & Compliance Office  
**Version:** 1.0.0  

---

## 1. Anti-Money Laundering (AML) & KYC Policy
Apex Arena is not a bank, but it moves money. We are obligated under the Prevention of Money Laundering Act (PMLA) guidelines to ensure criminals cannot integrate illicit funds into the banking system via our platform.

### 1.1 HyperVerge Mandatory Integration
Users cannot withdraw a single Rupee until their identity is cryptographically verified against Government databases.
1. **Aadhaar Verification:** Extracts Name, Date of Birth (Ensuring 18+), and Address (Ensuring non-banned state).
2. **PAN Verification:** Extracts the Permanent Account Number for mandatory TDS (Section 194BA) filings to the Income Tax Department.
3. **Name Match Logic:** The name on the Aadhaar card MUST exactly match the name on the PAN card, AND MUST exactly match the name registered on the destination Bank Account. If there is a mismatch, the withdrawal is frozen.

## 2. Data Protection & Privacy Compliance (DPDP Act)
The Digital Personal Data Protection (DPDP) Act of India imposes heavy restrictions on PII handling.

### 2.1 Data Minimization
- We do not store full Aadhaar numbers in plaintext.
- HyperVerge data is processed transiently. We only store the verification `status: "VERIFIED"`, the `State` of residence, and an encrypted hash of the `PAN` for tax purposes.
- We do not sell user behavioral data to third-party ad networks.

### 2.2 Right to Erasure
If a user requests account deletion, we soft-delete their profile (obscuring username/email). However, their financial `WalletLedger` rows and `KYC Hash` cannot be legally deleted for 5 years due to GST and Income Tax retention laws. The user is informed of this legal conflict during the deletion request.

## 3. Responsible Gaming Policy
To prevent intervention from regulatory bodies regarding gambling addiction, the platform enforces hard psychological and financial breaks.

### 3.1 Platform Limits
1. **Daily Deposit Limit:** A user cannot deposit more than ₹20,000 in a rolling 24-hour window without passing an enhanced manual Due Diligence check.
2. **Cool-Off Period:** Users can click a "Self-Exclude" button in their settings, completely locking them out of the `Deposit` and `Play` routes for a minimum of 48 hours. This action cannot be overridden by customer support.
3. **Loss Limits:** If a user loses 10 consecutive matches within 2 hours, the UI automatically triggers a "Take a Break" modal and pauses matchmaking for 15 minutes.
