# 8.1 Performance Requirements & 8.2 Scalability Requirements

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Lead Infrastructure Architect  
**Version:** 1.0.0  

---

## 1. Performance Requirements (Latency SLAs)
In a real-money chess game, a lagging clock directly causes financial loss. Performance is treated as a critical feature, not an afterthought.

### 1.1 WebSocket Latency (In-Game)
- **Target:** `< 50ms` ping from anywhere in India to the AWS `ap-south-1` region.
- **Clock Sync:** Client and server clocks must synchronize every 5 seconds. The server's clock is the absolute truth.
- **Move Validation:** The time between a user releasing a piece and the server broadcasting `Valid_Move` to both clients must not exceed `150ms`.

### 1.2 API Latency (Out-of-Game)
- **Database Reads:** Dashboard load time (Fetching balances, active tournaments) must resolve in under `200ms` via proper PostgreSQL indexing.
- **Database Writes:** Ledger deductions for joining a tournament must resolve in under `300ms`, despite utilizing heavy Row-Level Isolation Locks.

## 2. Scalability Requirements
Apex Arena is designed to rapidly scale to support 500,000+ users.

### 2.1 Horizontal Scalability (Compute)
The Fastify backend is 100% stateless. Scaling is purely horizontal.
- **MVP Capacity:** 10,000 Concurrent Users (CCU).
- **Scale Mechanism:** The AWS application load balancer (ALB) directs traffic across Auto Scaling Group (ASG) EC2 instances. If CPU spikes above 65%, a fresh identical EC2 node boots up. 
- **WebSocket Scaling Constraint:** Because WebSockets hold state (the open connection), the ALB uses Sticky Sessions to ensure a player's move commands continue hitting the specific Node.js process holding their match engine instance.

### 2.2 Vertical Scalability (Database)
Row-level locks in PostgreSQL scale elegantly until write contention hits extreme throughput (e.g., thousands of users joining the exact same tournament identically).
- **MVP Capacity:** Using an RDS `db.t4g.xlarge` instance allows for ~5,000 TPS (Transactions Per Second).
- **Read/Write Splitting:** The application logic is designed to send all `GET` queries (Dashboard loads) to read-replicas, keeping the absolute maximum compute power on the Master node reserved purely for `UPDATE` / `INSERT` ledger mutations.
