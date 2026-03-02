# 3.8 Infrastructure Design (Cloud AWS AWS) & 3.9 Deployment Architecture

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Principal DevOps Engineer  
**Version:** 1.0.0  

---

## 1. Cloud Network Topology (AWS Mumbai Region)
Operating in the `ap-south-1` region is statistically correlated with lowest latency for the target Indian demographic, which is critical for real-time WebSocket chess syncs.

### 1.1 Virtual Private Cloud (VPC)
The infrastructure is isolated inside a custom VPC (`10.0.0.0/16`) to prevent direct internet exposure of databases and compute nodes.

- **Public Subnets (2 AZs):** Contains the Application Load Balancer (ALB) and NAT Gateways.
- **Private Subnets (2 AZs):** Contains the Node.js Fastify EC2 instances. These machines strictly do *not* have public IP addresses.
- **Database Subnets (2 AZs):** Deeply isolated subnets housing the Amazon RDS PostgreSQL master and standby instances.

## 2. Component Layout & Traffic Routing

1. **User Chrome/Safari Base:**
   -> HTTPS -> Cloudflare (WAF/DDoS filtering, DNS resolution).
2. **Cloudflare Edge:**
   -> AWS Application Load Balancer (ALB) on Port 443. 
   *(Note: Cloudflare terminating edge SSL. ALB terminating internal SSL. Strict port 80 blocking at Security Group level).*
3. **AWS ALB:** 
   -> Routes traffic via Target Groups to the Auto-Scaling Group (ASG) of EC2 Instances on Port 3000.
4. **EC2 Instances (Fastify Node.js):**
   -> Queries RDS PostgreSQL via private VPC endpoints on Port 5432.
   -> Pings Cashfree / HyperVerge API over the internet by dialing out through the NAT Gateway.

## 3. High Availability (HA) & Fault Tolerance
- **Database Failover:** Amazon RDS is configured in a "Multi-AZ" setup. If the primary database in Availability Zone A suffers a hardware failure, AWS automatically performs a DNS flip to the synchronous standby replica in Availability Zone B within 60 seconds. The application layer (Prisma) is configured to automatically retry connection drops.
- **Compute Scalability:** EC2 instances are governed by an Auto-Scaling Group. 
  - *Scale-out Policy:* If Average CPU Utilization > 65% for 3 minutes, launch 1 new instance.
  - *Health Checks:* ALB pings `/api/health` every 10 seconds. If 3 consecutive failures occur, the EC2 instance is terminated and freshly provisioned.

## 4. Security Groups (Virtual Firewalls)
| Security Group | Inbound Rules | Outbound Rules |
| :--- | :--- | :--- |
| **ALB-SG** | Allow HTTPS (443) from Cloudflare IPs ONLY | Allow Traffic to EC2-SG |
| **EC2-SG** | Allow Port 3000 from ALB-SG ONLY | Allow All to NAT (Internet) |
| **RDS-SG** | Allow Port 5432 from EC2-SG ONLY | Deny All |

*By restricting the ALB to only accept traffic from Cloudflare's published IP ranges, attackers cannot bypass the WAF by attempting to dial the AWS ALB IP directly.*

## 5. Environment Separation
The architecture requires three distinct environments to protect the integrity of financial algorithms.

- **Production (`api.apexarena.in`):** Uses Live Cashfree Keys, Real HyperVerge credits, Real money ledgers. Only DevOps leads have SSH access.
- **Staging (`stage.apexarena.in`):** Exact mirrored terraform infrastructure. Uses Cashfree Sandbox Keys. Linked to a staging RDS instance loaded with scrubbed dummy data for pre-deployment regression testing.
- **Local (`localhost`):** Developer machines running Docker-compose (contains a local Postgres container and the fastify server). Uses `.env.local` to point to test turnstile keys.
