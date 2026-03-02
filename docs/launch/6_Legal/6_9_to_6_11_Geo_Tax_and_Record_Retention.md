# 6.9 Geo-Restriction, 6.10 Tax & 6.11 Record Retention

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Operations & Finance Teams  
**Version:** 1.0.0  

---

## 1. Geo-Restriction Plan
Apex Arena cannot legally operate in specific states representing ~20% of India's population. Allowing users from these states constitutes illegal gambling operations under their respective local Police Acts.

### 1.1 The Blocklist
- Telangana, Andhra Pradesh, Assam, Odisha, Nagaland, Sikkim.

### 1.2 The Tri-Gate Fencing Strategy
1. **Gate 1: IP Intelligence (Cloudflare/Backend):** Every HTTP request is checked against a Geo-IP database. If the IP maps to a banned state, the `/wallet` and `/tournaments` routes return `403 Forbidden`.
2. **Gate 2: GPS Check (Optional/Future Mobile App):** App requests device location. Trumps IP data.
3. **Gate 3: KYC Address Extraction (The Ultimate Truth):** Upon Aadhaar verification (HyperVerge), the residential state is extracted. If it is a banned state, the account is permanently locked, and existing deposit funds are forcibly refunded to the source bank.

## 2. Tax Compliance Strategy (Section 194BA)
As of April 1, 2023, the Income Tax Act mandates RMG platforms to deduct Tax Deducted at Source (TDS) at 30% on "Net Winnings".

### 2.1 The Formula (Coded into Postgres)
`Net Winnings = (Total Withdrawals in FY + Current Withdrawal Amount) - Total Deposits in FY`

- **Scenario A:** User deposited ₹100. Won ₹500 (Wallet=600). Tries to withdraw ₹200.
  - Net Winnings = `(0 + 200) - 100` = `100`.
  - TDS = `30% of 100` = ₹30.
  - User receives Bank Transfer of ₹170.
- **Scenario B:** User deposited ₹1000. Won ₹200 (Wallet=1200). Tries to withdraw ₹200.
  - Net Winnings = `(0 + 200) - 1000` = `-800`.
  - TDS = ₹0 (Because Net Winnings is negative).
  - User receives Bank Transfer of ₹200.

### 2.2 Operational Filing
- The ₹30 deducted in Scenario A is held in the company's designated Tax Bank Account.
- At the end of every quarter, the company files **Form 26Q** with the Govt, uploading the user's PAN and depositing the accumulated TDS.

## 3. Record Retention Policy
We cannot delete financial logs just to save RDS storage costs.

### 3.1 Minimum Retention Periods
- **Identity Records (KYC):** 5 years post account closure (PMLA requirement).
- **Wallet Ledger & Transactions:** 8 years (Income Tax requirement for audit trails).
- **Chess Move Logs (Matches):** 6 months (For resolving game dispute tickets or investigating anti-cheat algorithms).

### 3.2 Cold Storage Strategy
To keep the primary Postgres database blazing fast, `Transaction` and `WalletLedger` rows older than 12 months are aggregated, zipped into encrypted CSVs, and pushed to Amazon S3 Glacier Deep Archive, before being hard-deleted from RDS.
