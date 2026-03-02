# 5.1 SRD, 5.2 Auth & 5.3 RBAC, 5.4 Encryption

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Chief Information Security Officer (CISO)  
**Version:** 1.0.0  

---

## 1. Security Requirements Document (SRD)
Because Apex Arena functions identically to a specialized bank offering games of skill, security is not a feature; it is the fundamental core. 

### 1.1 Core Principles
- **Verify Everything:** Never trust the client (Next.js PWA). All math, chess move legality, and geographical scoping must occur on the Fastify backend.
- **Defense in Depth:** If Cloudflare WAF fails, the API rate limiter kicks in. If the rate limiter fails, Database Row Locking blocks concurrent mutations.
- **Least Privilege:** Fastify only connects to PostgreSQL via an IAM role restricted to `SELECT`, `UPDATE`, `INSERT`. It cannot `DROP TABLE`.

## 2. Authentication & Authorization Design
- **Bot Mitigation:** Cloudflare Turnstile blocks completely automated account creation tools (e.g., Selenium/Puppeteer) on the `/register` and `/login` routes.
- **Stateless Tokens:** Fastify generates JSON Web Tokens (JWT) signed via HMAC SHA-256 (`HS256`).
- **Storage:** JWTs are stored client-side in secure HTTP-Only cookies to explicitly block Cross-Site Scripting (XSS) attacks from extracting the token and impersonating users via Cross-Site Request Forgery (CSRF).

## 3. Role-Based Access Control (RBAC) Matrix
Admin panel security is paramount. A compromised admin account means instant financial loss.

| Role | Wallet Read | Wallet Mutate | Approve Withdrawals | Override KYC | Create Admins |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **USER** | Own Only | Own Only | Not Applicable | Not Applicable | No |
| **SUPPORT_AGENT** | All | No | No | No | No |
| **RISK_ANALYST** | All | No | **YES** (< ₹50k) | **YES** | No |
| **SUPER_ADMIN** | All | **YES** (Refunds) | **YES** (Any) | **YES** | **YES** |

*Rule:* Every `RISK_ANALYST` action (Approving a withdrawal) forces an immutable log entry in the `AuditLog` table capturing their Admin ID, timestamp, and target User ID.

## 4. Encryption Architecture
### 4.1 In Transit
- All external HTTP traffic is forced over `TLS 1.3`. Port 80 is strictly dropped at the AWS ALB.
- WebSockets for chess gameplay use `WSS://` (WebSocket Secure).

### 4.2 At Rest
- Amazon RDS instances utilize AWS KMS (Key Management Service) symmetric encryption for the entire database volume.
- **Sensitive PII:** The `panCardNumber` stored in Postgres is manually encrypted at the Application layer (Fastify) using `aes-256-gcm` before insertion. The Initializing Vector (IV) is stored alongside the cipher text. The master key resides strictly in AWS Secrets Manager. If a DBA dumps the Postgres table, the PANs remain utterly useless.
