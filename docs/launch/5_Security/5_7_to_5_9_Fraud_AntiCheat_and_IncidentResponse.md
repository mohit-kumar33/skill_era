# 5.7 Fraud Detection Architecture, 5.8 Anti-Cheat, 5.9 Incident Response

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Risk & Infosec Team  
**Version:** 1.0.0  

---

## 1. Fraud Detection Architecture
Fraudsters explicitly hunt for RMG platforms offering withdrawals. The most common attack vector is "Chip Dumping" (laundering stolen credit card money by losing matches to a clean account).

### 1.1 The Heuristics Engine (Post-MVP Automation)
While MVP relies on manual withdrawal reviews, the backend still logs heuristics silently to flag suspicious behavior.
- **IP Collisions:** If two users in a 1v1 match share the same IP address or device fingerprint, their accounts are automatically locked from withdrawals pending review.
- **Match Duration:** If a ₹500 high-stakes match concludes in under 10 seconds via resignation, it is heavily flagged for Chip Dumping. 
- **Geolocation Velocity:** If a user logs in from Maharashtra, and 45 minutes later logs in from Delhi (which is physically impossible), the session token is invalidated.

## 2. Anti-Cheat Controls (Chess Engine)
Chess is fully deterministic, allowing for profound anti-cheat mechanisms.

### 2.1 Server-Side Evaluation
- The frontend Next.js (react-chessboard) merely *suggests* a move. 
- Fastify queries `chess.js` or `Stockfish`. If the move is mathematically illegal, the client state is hard-synced back to reality.
- Time control (`Clock`) is calculated exclusively on the server, accounting for ping latency. A client hacking javascript to freeze their timer does nothing.

### 2.2 External Assistance (Engine Abuse)
If a player pulls out their phone and asks Stockfish 16 for the absolute best Grandmaster move every single turn, they will crush legitimate players.
- **Browser Focus Polling:** The Next.js frontend monitors the `visibilitychange` window event. If the user repeatedly swaps tabs/windows for 5+ seconds right before making brilliant moves, the game is `FLAgGED`.
- **Centipawn Loss Analysis (Post-Game):** We run the move history through an asynchronous Stockfish analyzer. If a 1200 Elo player mysteriously achieved an Average Centipawn Loss of 8 (playing exactly like a machine for 40 moves), they are banned.

## 3. Incident Response (IR) Plan
When a catastrophic exploit is discovered (e.g., Ledger calculation bug leaking money).

### 3.1 Severity 1 PagerDuty (Critical Core Financial Exploit)
1. **Detection:** Reconciliation cron job fails, or Risk Analyst notices unbacked `WinningBalance`.
2. **Containment (T+0 mins):** The CTO or automated watcher executes the "Kill Switch" endpoint on the Admin Panel, immediately halting ALL Cashfree payout jobs and preventing any new matches from starting.
3. **Eradication (T+30 mins):** Engineering identifies the logic bug via PostgreSQL Audit Logs. Database backups are instantly generated to freeze the forensic state.
4. **Recovery (T+6 hours):** Bug fixed, tested, and hotfixed to production. Ledger discrepancies are manually reversed by the DBA. Users are emailed explaining a "Maintenance Delay."
