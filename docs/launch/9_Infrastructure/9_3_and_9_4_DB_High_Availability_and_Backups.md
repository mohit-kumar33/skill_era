# 9.3 Database High Availability Plan & 9.4 Backup Architecture

**Project Name:** Apex Arena (MVP)  
**Document Owner:** DBA Team  
**Version:** 1.0.0  

---

## 1. Database High Availability (HA) Plan
Downtime on the primary PostgreSQL node results in an immediate suspension of all new tournament creations and wallet deposits.

### 1.1 Multi-AZ Deployment Model
Amazon RDS is provisioned in a Multi-AZ configuration.
- **The Primary Node:** Resides in Availability Zone A (e.g., `ap-south-1a`). Processes all Read/Write traffic.
- **The Standby Node:** Resides in Availability Zone B (e.g., `ap-south-1b`). It is strictly a "hot spare". AWS performs synchronous block-level replication from the Primary to the Standby.

### 1.2 Failover Mechanics
If the Primary Node experiences a hardware failure, network partition, or OS crash:
1. AWS detects the failure (typically < 30 seconds).
2. AWS automatically flips the RDS DNS endpoint to point entirely to the Standby Node in AZ-B.
3. The Fastify applications utilizing Prisma will experience temporary network drops, and their automated retry mechanics will restablish connections to the new Primary node. Complete automated recovery within ~60-120 seconds.

## 2. Backup Architecture
Backups are the ultimate safeguard against a rogue developer dropping a table or ransomware encrypting the storage blocks.

### 2.1 Automated Snapshots (Short-Term Recovery)
- AWS RDS automatically performs a full instance snapshot daily at 02:00 AM IST.
- Continuous WAL (Write-Ahead Logs) are archived every 5 minutes to S3, enabling **Point-in-Time Recovery (PITR)**. If data is corrupted at 14:26 IST, the DBA can restore the entire database exact state as of 14:25 IST.
- Retention Period: 35 Days natively in RDS.

### 2.2 Cross-Region Immutable Backups (Disaster Recovery)
- Once a week, the automated AWS Backup system copies a snapshot from the Mumbai region (`ap-south-1`) to the Singapore region (`ap-southeast-1`).
- These backups are marked as **Immutable** (using AWS Object Lock). Even if the AWS Root Account is compromised by a hacker, the cross-region snapshots cannot be deleted until their 3-year expiration date.
