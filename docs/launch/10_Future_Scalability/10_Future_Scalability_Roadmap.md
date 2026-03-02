# 10. Future Scalability Roadmap (MVP to 500,000 CCU)

**Project Name:** Apex Arena  
**Document Owner:** Chief Technology Officer (CTO)  
**Version:** 1.0.0  

---

## 1. Monolith → Microservices Migration Plan
While the MVP operates as a modular Fastify monolith connected to a single PostgreSQL writer, scaling beyond 50,000 Concurrent Users (CCU) requires fracturing the architecture to prevent horizontal compute scaling from exhausting the database connection pool.

### 1.1 Service Extraction Order
Services will be extracted strictly based on their resource friction profile.

**Target 1: The Matchmaking Queue Service**
- *Reason:* Polling the database to find matched opponents is highly read-intensive and locking.
- *Extraction:* Move the queue entirely into Redis (Sorted Sets). A dedicated Go/Rust microservice consumes the queue and orchestrates the matchmaking without touching Postgres.

**Target 2: The Gameplay Engine (WebSockets)**
- *Reason:* Node.js is single-threaded. Holding 50,000 active WebSocket connections creates massive Event Loop latency, disrupting chess clock synchronization.
- *Extraction:* Re-write the `/ws/play` subsystem in Golang or Rust to utilize millions of ultra-lightweight Goroutines/Threads.

**Target 3: The Wallet Ledger Service**
- *Reason:* Pure financial security and isolation.
- *Extraction:* Remove all direct Prisma database access from the main REST API. The API must make a strict gRPC call to a deeply isolated backend Wallet Microservice, which holds exclusive credentials to mutate the PostgreSQL database.

## 2. Event-Driven Architecture (EDA) Plan
Post-extraction, services cannot rely on synchronous REST HTTP calls (which cause cascading failures if one node slows down).

### 2.1 The Kafka / Amazon SQS Backbone
- **The Event:** `Match_Result_Published`
- **The Producer:** The Gameplay Engine (Go) publishes `{"matchId": "XYZ", "winner": "UserA"}` to Kafka.
- **The Consumer:** The Wallet Ledger Service (Node.js/Prisma) listens to the topic. It picks off the message, secures the row locks, credits User A, and commits.
- *Benefit:* If the Wallet database is overwhelmed, the Gameplay engine doesn't crash. It simply keeps pumping messages into Kafka, and the Wallet Service drains them at its maximum safe speed.

## 3. Database Sharding Plan
When the single PostgreSQL master hits max write IOPS (typically around 15,000 TPS), we must shard (partition) the data across multiple masters.

### 3.1 Ledger Sharding by `UserId` Modulo
- **Shard 1 (DB_A):** Holds all Wallet LEDGERS where `uuid % 2 == 0`
- **Shard 2 (DB_B):** Holds all Wallet LEDGERS where `uuid % 2 == 1`
- *Execution:* Reduces database IOPS load by exactly 50% per cluster. The application layer (or an intermediate tool like Vitess / Citus) handles routing the query to the correct physical database node based on the user's ID.

## 4. Multi-Region Deployment Plan
If Apex Arena expands out of India (e.g., matching players in the Middle East or SEA), routing all WebSocket traffic to Mumbai (`ap-south-1`) will cause latency degradation.

### 4.1 Geo-DNS Routing via Cloudflare
- Users in India -> Route53 -> AWS `ap-south-1` (Mumbai).
- Users in UAE -> Route53 -> AWS `me-south-1` (Bahrain).

### 4.2 State Synchronization 
- **The Struggle:** If User A (UAE) challenges User B (India), where is the match hosted?
- **The Solution:** The Matchmaking Service acts as a global orchestrator. It calculates the mid-point latency between both clients and assigns them a temporary WebSocket token to a "Stateless Game Fleet Server" hosted in the most equitable geographic region. Only the final `Match_Result_Published` event is funneled back to the global Ledger database in Mumbai.
