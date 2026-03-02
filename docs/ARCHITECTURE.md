# Deployment Architecture Diagram

```mermaid
graph TD
    subgraph Client
        Browser[Web App Client]
        Mobile[Mobile App Client]
    end

    subgraph Edge
        CF[Cloudflare WAF/CDN]
    end

    subgraph VPC - Public Subnet
        ALB[Application Load Balancer]
        NAT[NAT Gateway]
    end

    subgraph VPC - Private Subnet (App Tier)
        API1[Fastify App Node 1]
        API2[Fastify App Node 2]
        API3[Fastify App Node 3]
    end

    subgraph VPC - Private Subnet (Data Tier)
        RDS_M[(PostgreSQL Master)]
        RDS_R[(PostgreSQL Replica)]
        Elasticache[(Redis Cluster)]
    end

    subgraph External Services
        PG[Payment Gateway]
        KYC[KYC Provider]
        SMS[AWS SNS / SMS Gateway]
        SG[SendGrid / Email]
    end

    Browser -->|HTTPS| CF
    Mobile -->|HTTPS| CF
    CF -->|HTTPS| ALB
    ALB -->|HTTP/2| API1
    ALB -->|HTTP/2| API2
    ALB -->|HTTP/2| API3

    API1 -->|TCP/5432| RDS_M
    API2 -->|TCP/5432| RDS_M
    API3 -->|TCP/5432| RDS_M
    
    RDS_M -.->|Async Replication| RDS_R
    
    API1 -->|TCP/6379| Elasticache
    API2 -->|TCP/6379| Elasticache
    API3 -->|TCP/6379| Elasticache

    API1 -->|HTTPS via NAT| PG
    API2 -->|HTTPS via NAT| KYC
    API3 -->|HTTPS via NAT| SMS
```

## Description
This diagram outlines the target deployment architecture for the Skill Era backend. The goal is high availability and secure segregation of the data tier.

### Components
1. **Edge:** Cloudflare provides DDoS protection and CDN caching.
2. **Public Subnet:** Only the Application Load Balancer and NAT Gateway reside here.
3. **App Tier (Private):** Fastify nodes (running in ECS/EKS or EC2 Auto Scaling Group). These nodes have no public IP and route outbound traffic through the NAT Gateway.
4. **Data Tier (Private):** Strict security groups only allow access from the App Tier. Multi-AZ PostgreSQL for resilience, and Redis for distributed caching, session locking, and rate-limiting.
