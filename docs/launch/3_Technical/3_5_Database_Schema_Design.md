# 3.5 Database Schema Design (Prisma / PostgreSQL)

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Lead Database Administrator  
**Version:** 1.0.0  

---

## 1. Golden Rules of the RMG Schema
1. **Never use Floats:** All monetary values MUST be stored as integers representing the smallest currency unit (e.g., Paise). ₹100 is stored as `10000`.
2. **Never hard-delete:** Financial records, tournaments, and users cannot be `deleted`. They are `anonymized` or `archived` to maintain ledger integrity and comply with AML data retention laws.
3. **Strict Relationships:** A `Transaction` must point to a specific `User`. A `TournamentResult` must point to two specific `Users` and one `Tournament`.

## 2. Core Entities

### 2.1 User
| Field | Type | Description | Index / Constraints |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | 
| `email` | String | Login identifier | UNIQUE |
| `phone` | String? | 2FA Mobile | UNIQUE |
| `password` | String | Bcrypt hash | |
| `depositBalance` | Int | Real money added (Paise) | Default: 0 |
| `winningBalance` | Int | Money won (Paise) | Default: 0 |
| `kycStatus` | Enum | `UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED` | Default: `UNVERIFIED` |
| `panCaryNumber`| String?| Encrypted PAN for 194BA Tax | UNIQUE |
| `createdAt` | DateTime| Timestamp | |

### 2.2 WalletLedger
*This table is the immutable source of truth for all balances. The `User` table balance columns are merely materialized views of this table.*
| Field | Type | Description | Index / Constraints |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `userId` | UUID | Foreign Key -> User | INDEXED |
| `amount` | Int | Amount in Paise (Positive = Credit, Negative = Debit) | |
| `balanceType`| Enum | `DEPOSIT`, `WINNING` | |
| `sourceType` | Enum | `DEPOSIT_CASHFREE`, `TOURNAMENT_WIN`, `TOURNAMENT_FEE`, `WITHDRAWAL` | |
| `referenceId`| String | Points to `Transaction.id` or `Tournament.id` | INDEXED |
| `createdAt` | DateTime| Timestamp (Immutable) | |

### 2.3 Transaction (Cashfree Gateway Maps)
| Field | Type | Description | Index / Constraints |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `userId` | UUID | Foreign Key -> User | INDEXED |
| `type` | Enum | `DEPOSIT`, `WITHDRAWAL`, `REFUND` | |
| `amount` | Int | Gross amount requested | |
| `status` | Enum | `PENDING`, `SUCCESS`, `FAILED`, `REVERTED` | INDEXED |
| `gatewayId` | String? | Matches Cashfree `cf_order_id` or `cf_payout_id`| UNIQUE |
| `metadata` | JSONB | Raw webhook dump for audit trails | |

### 2.4 Tournament & Participant
| Field | Type | Description | Index / Constraints |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `entryFee` | Int | Cost to join (Paise) | |
| `prizePool` | Int | Total payout to winner (Paise) | |
| `status` | Enum | `OPEN`, `FULL`, `ACTIVE`, `COMPLETED`, `CANCELED` | INDEXED |

*Participant (N:M Relation Table)*
| Field | Type | Description | Index / Constraints |
| :--- | :--- | :--- | :--- |
| `tournamentId`| UUID | Foreign Key | Compound PK |
| `userId` | UUID | Foreign Key | Compound PK |
| `joinedAt` | DateTime| When fee was deducted | |
| `result` | Enum | `WINNER`, `LOSER`, `DRAW` | Nullable until match ends |

## 3. Database Constraints & Triggers
Because the Fastify application layer could theoretically be bypassed or contain a logic bug, the database enforces the ultimate fail-safes.
- **CHECK `DepositBalance >= 0`:** The database will inherently reject any SQL update query that attempts to drop a balance below 0. This enforces the "No Credit" rule at the lowest level.
