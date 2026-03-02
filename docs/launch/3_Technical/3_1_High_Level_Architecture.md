# 3.1 High-Level Architecture Design (HLD)

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Chief Technology Officer (CTO) / Lead Architect  
**Version:** 1.0.0  

---

## 1. Architectural Principles
Apex Arena follows a **Cloud-Native, Monolithic-First** approach for its MVP phase to reduce DevOps complexity while operating under heavy modular boundaries internally. This ensures the codebase can cleanly fracture into microservices (e.g., Wallet Service, Chess Engine) when scaling to 500,000+ users.

## 2. Infrastructure Topology (AWS ap-south-1)

### 2.1 The Edge Layer (Cloudflare)
- **DNS Route53:** Resolves to Cloudflare edge.
- **WAF & DDoS Mitigation:** Blocks L3/L4 and hostile L7 traffic before it hits AWS.
- **Bot Management:** Turnstile interceptors validate human presence on `/register` and `/login`.
- **CDN:** Caches all Next.js static assets and imagery, vastly reducing EC2 load.

### 2.2 The Presentation Layer (Vercel/Netlify/S3)
- **User Frontend (Next.js):** PWA optimized for mobile Chrome/Safari. 
- **Admin Panel (Next.js):** Desktop-optimized dashboard for manual transaction review.

### 2.3 The Application Layer (AWS EC2 / Auto-Scaling Group)
- **Compute:** Fastify (Node.js) server running in Docker containers. Multi-threaded via PM2 cluster mode to fully utilize EC2 vCPUs.
- **Statelessness:** The web servers hold zero session state. All auth is JWT-based. Any EC2 node can die and be replaced instantly without dropping active sessions.

### 2.4 The Data Layer (AWS RDS)
- **Primary Database:** PostgreSQL 16 on Amazon RDS (Multi-AZ for automatic failover).
- **ORM:** Prisma Client for typesafe schema management.
- **Cache (Future):** Redis ElastiCache (to be added post-MVP for matchmaking lobby queues).

## 3. External Integrations Matrix

| System | Protocol | Use Case | Failure Mechanism |
| :--- | :--- | :--- | :--- |
| **Cashfree Payments** | REST API + Webhooks | Processing UPI/Card Deposits | If webhook drops, cron job polls Cashfree `/status` endpoint for orphans. |
| **Cashfree Payouts** | REST API | Executing User Withdrawals | Synchronous balance check before dispatching async payout. |
| **HyperVerge** | REST API | Aadhaar/PAN Identity checks | Fallback to manual document upload if API is down. |
| **Stockfish Engine** | Wasm/Native | Verifying legal chess moves | Hard-fail. If engine crashes, tournament is voided and funds refunded. |

## 4. Architectural Data Flow Snapshot (Deposit)
1. **Client** POSTs `/api/wallet/deposit`.
2. **Fastify** validates JWT and creates `PENDING` transaction in Postgres.
3. **Fastify** requests Cashfree Order URL.
4. **Client** redirects to Cashfree. Cashfree captures money.
5. **Cashfree Webhook** POSTs `SUCCESS` payload to Fastify.
6. **Fastify Webhook Handler** verifies `x-webhook-signature`.
7. **Prisma** opens transaction -> executes `SELECT FOR UPDATE` on User Wallet -> increments `DepositBalance` -> updates Transaction status to `SUCCESS` -> Commits.
