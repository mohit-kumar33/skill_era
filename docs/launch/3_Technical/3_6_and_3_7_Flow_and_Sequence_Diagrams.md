# 3.6 Data Flow Diagrams & 3.7 Sequence Diagrams

**Project Name:** Apex Arena (MVP)  
**Document Owner:** System Architect  
**Version:** 1.0.0  

---

## 1. Wallet Deposit Data Flow (Cashfree Integration)

```mermaid
sequenceDiagram
    participant U as User (Next.js)
    participant B as Backend (Fastify)
    participant CF as Cashfree (Gateway)
    participant DB as Postgres (Ledger)

    U->>B: POST /api/wallet/deposit (₹500)
    B->>DB: INSERT Transaction (PENDING, ₹500)
    B->>CF: POST /orders (Create Cashfree Session)
    CF-->>B: Return payment_session_id
    B-->>U: Return Checkout URL
    
    note over U,CF: User completes UPI payment on Cashfree UI
    
    CF->>B: Webhook POST (ORDER_SUCCESS, Signature)
    note right of B: Fastify verifies HMAC Signature
    
    B->>DB: INIT TRANSACTION
    B->>DB: SELECT * FROM User WHERE id=X FOR UPDATE
    B->>DB: UPDATE Transaction SET status='SUCCESS'
    B->>DB: INSERT Ledger Entry (+₹500 DEPOSIT)
    B->>DB: UPDATE User SET depositBalance = depositBalance + 500
    B->>DB: COMMIT TRANSACTION
    
    B-->>CF: 200 OK (Stop webhook retries)
    B-->>U: WebSockets broadcast Wallet Update
```

## 2. Matchmaking & Prize Settlement Flow

```mermaid
sequenceDiagram
    participant P1 as Player 1
    participant P2 as Player 2
    participant B as Backend (Fastify)
    participant W as Wallet Module
    participant DB as Database

    P1->>B: JOIN Tournament T1 (Fee: ₹50)
    B->>W: deduct(P1, ₹50)
    W->>DB: Lock P1 -> Deduct Balance -> Insert Ledger Debit -> Commit
    B->>DB: Update Tournament (P1 status: WAITING)
    B-->>P1: Joined. Waiting for opponent...
    
    P2->>B: JOIN Tournament T1 (Fee: ₹50)
    B->>W: deduct(P2, ₹50)
    W->>DB: Lock P2 -> Deduct Balance -> Insert Ledger Debit -> Commit
    B->>DB: Update Tournament (P2 joined, status: ACTIVE)
    B->>P1: WebSocket: MATCH_START
    B->>P2: WebSocket: MATCH_START
    
    note over P1,P2: Chess match occurs over WebSockets
    
    P1->>B: WebSocket: CHECKMATE (Win claim)
    note right of B: Stockfish Engine validates the mate on the server
    B->>DB: Update Tournament (status: COMPLETED)
    B->>DB: Insert TournamentResult (P1=Win, P2=Loss)
    
    B->>W: awardPrize(P1, ₹85)
    note right of B: Platform retains ₹15 Commission
    W->>DB: Lock P1 -> Add WinningBalance -> Insert Ledger Credit -> Commit
```

## 3. Withdrawal & KYC Enforcement Flow

```mermaid
sequenceDiagram
    participant U as User
    participant B as Backend
    participant RDS as Database
    participant Admin as Risk Desk
    participant CF as Cashfree Payouts

    U->>B: Request Withdrawal (₹100)
    B->>RDS: Check KYC Status
    RDS-->>B: Status = VERIFIED
    B->>RDS: Check Cooldown (Last Deposit > 24h)
    RDS-->>B: Valid
    B->>RDS: Calculate TDS (Net Winnings > 0?)
    RDS-->>B: Yes, TDS = ₹30. Net Payout = ₹70
    
    B->>RDS: Lock User -> Deduct ₹100 from WinningBalance
    B->>RDS: Insert Pending_Withdrawal(₹70), Insert TDS_Record(₹30)
    B-->>U: Withdrawal Queued for Review
    
    note over Admin,B: Manual Review Process (MVP Phase)
    Admin->>B: Click "Approve Withdrawal"
    B->>CF: API Call: Disburse ₹70 via IMPS
    CF-->>B: Payout SUCCESS
    
    B->>RDS: Update Pending_Withdrawal -> SUCCESS
    B->>RDS: Insert Ledger Credit (Confirming final exit)
    
    B-->>U: Send Email "Your ₹70 is on the way!"
```
