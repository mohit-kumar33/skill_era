# 9.5 Monitoring Strategy & 9.6 Scaling Roadmap (MVP → 500K Users)

**Project Name:** Apex Arena  
**Document Owner:** Infrastructure Architect  
**Version:** 1.0.0  

---

## 1. Monitoring & Alerting Strategy

### 1.1 Infrastructure Telemetry Matrix
| Metric | Alert Threshold | Action |
| :--- | :--- | :--- |
| **EC2 CPU Utilization** | > 65% for 3 mins | AWS Auto-Scaling launches new instance. |
| **EC2 Memory Utilization**| > 85% for 5 mins | Trigger PM2 memory restart on Node.js process (Memory leak mitigation). |
| **RDS DB Connections** | > 80% of max | PagerDuty SRE. Requires `PgBouncer` tuning. |
| **ALB 5xx Error Rate** | > 2% of total traffic| Slack `#dev-alerts` and PagerDuty entire team. |

## 2. The Scaling Roadmap (10K to 500K CCU)
The MVP monolith is designed to cleanly fracture at specific stress points as user concurrency hits the mathematical limits of a single PostgreSQL writer.

### 2.1 Phase 1: MVP (0 - 10,000 CCU)
- **Architecture:** Node.js Monolith + Single Multi-AZ RDS Postgres Writer.
- **Bottleneck:** None. The t4g.xlarge RDS can comfortably handle 10k CCU ledger mutations using raw Row-Level Locks.

### 2.2 Phase 2: Growth (10,000 - 50,000 CCU)
- **Problem:** Database read contention. Users constantly checking dashboards and lobby listings slows down the crucial wallet deduction updates.
- **Action:** Introduce **RDS Read Replicas**. The application code is modified so `prisma.$queryRaw(SELECT...)` routes to the Read Replica, completely freeing the Writer node for pure financial mutations.

### 2.3 Phase 3: Mass Market (50,000 - 250,000 CCU)
- **Problem:** Tournament Matchmaking logic becomes too heavy to compute on the REST API servers.
- **Action:** Introduce **Redis (Amazon ElastiCache)**. Matchmaking queues are moved entirely into Redis memory using Sorted Sets (ZADD). The PostgreSQL database is only interacted with *after* a match is found and funds need locking.

### 2.4 Phase 4: Apex Scale (250,000 - 500,000+ CCU)
- **Problem:** The single monolithic Fastify application holds too many simultaneous WebSocket connections, causing Event Loop lag which desyncs the chess clocks.
- **Action:** Microservice Fracture via **Event-Driven Architecture (Kafka/SQS)**.
  - Extract the Wallet Ledger into a completely isolated gRPC microservice (`Wallet API`).
  - Extract the Chess Engine WebSockets into horizontally scalable Go/Rust microservices (`Game Fleet`).
  - Use Amazon SQS to queue the `Match_Result_Published` event, which the `Wallet API` picks up asynchronously to process payouts.
