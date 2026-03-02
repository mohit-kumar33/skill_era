# 9.1 Cloud Topology Design & 9.2 Load Balancing Strategy

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Cloud Architect  
**Version:** 1.0.0  

---

## 1. Cloud Topology Design (AWS ap-south-1)
The infrastructure is designed using a "Defense in Depth" VPC architecture in the Mumbai region to guarantee extremely low latency across India.

### 1.1 VPC Structure (`10.0.0.0/16`)
- **Public Subnets (AZ-A, AZ-B):** Contains NAT Gateways and the Application Load Balancer (ALB). These are the only resources with Internet Gateways.
- **Private Subnets (AZ-A, AZ-B):** Contains the Fastify Node.js EC2 instances. They have no public IP addresses. They dial out via the NAT Gateway to reach Cashfree.
- **Data Subnets (AZ-A, AZ-B):** Isolated private subnets housing the Amazon RDS PostgreSQL instances and Elasticache (future). No direct internet route exists here.

## 2. Load Balancing Strategy

Because Apex Arena utilizes both stateless REST APIs (for wallets/dashboard) and stateful WebSockets (for live chess matches), the load balancing strategy requires mixed configurations.

### 2.1 The Application Load Balancer (ALB)
- **Target Group A (REST API - Port 3000):** Traffic destined for `/api/wallet` or `/api/auth` is distributed across all healthy EC2 instances using the default `Round Robin` algorithm.
- **Target Group B (WebSockets - Port 3000):** Traffic destined for `/ws/play` must maintain a persistent TCP connection to the specific Node.js process holding that match outcome in memory.
  - *Configuration:* "ALB Sticky Sessions" (Application-based cookie) is enabled. If Player 1 connects to `EC2-Node-A`, all subsequent WebSocket pings for that match are forcefully routed to `EC2-Node-A` until the match concludes.

### 2.2 SSL Termination
- Cloudflare terminates SSL for the end-user (e.g., User to Cloudflare edge = `TLS 1.3`).
- The ALB terminates SSL for the origin link (Cloudflare to AWS ALB = `TLS 1.2+`).
- Internal VPC traffic between the ALB and the EC2 instances flows over AWS private networking (HTTP port 3000) to reduce CPU overhead on the compute nodes attempting to decrypt traffic unnecessarily.
