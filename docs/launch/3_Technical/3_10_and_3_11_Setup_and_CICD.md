# 3.10 Environment Setup Guide & 3.11 CI/CD Pipeline Plan

**Project Name:** Apex Arena (MVP)  
**Document Owner:** DevOps / Release Manager  
**Version:** 1.0.0  

---

## 1. Local Developer Environment Setup

To ensure parity between a developer's local machine and the production AWS environment, the project uses Docker containerization.

### 1.1 Prerequisites
- Node.js (v20 LTS recommended)
- Docker Desktop & Docker Compose
- PostgreSQL Client (e.g., pgAdmin, DBeaver)
- Git (configured to push to main repo)

### 1.2 Bootstrapping the Local Stack
1. **Clone the repository:** `git clone git@github.com:apexarena/core.git`
2. **Setup Environment Variables:** Duplicate `.env.example` to `.env.local` and substitute the real Cashfree Test Credentials and a `TURNSTILE_TEST_SECRET_KEY`.
3. **Start the Database:** Run `docker-compose up -d postgres`. This boots a local PostgreSQL 16 container on port 5432.
4. **Run DB Migrations:** Execute `npx prisma migrate dev` to push the current schema to the local Docker container.
5. **Start Dev Servers:** 
   - Backend: `npm run dev:backend` (Fastify on port 3001)
   - Frontend: `npm run dev:web` (Next.js on port 3000)

## 2. Continuous Integration (CI) Checks

The project utilizes GitHub Actions to enforce strict quality gates before any code merges into the `main` branch. Bypassing these gates is physically restricted by repository settings.

### 2.1 The Build Pipeline (Trigger on PR to `main`)
- **Linting:** Executes `npm run lint`. Fails if any implicit `any` TypeScript rules are violated.
- **Dependency Audit:** Runs `npm audit --audit-level=high`. Fails if critical vulnerabilities are found in the package tree.
- **Unit Testing:** Executes Vitest against isolated functions (Math precision checks on wallet ledger).
- **Red Team Integration Testing:** Spins up a disposable PostgreSQL container. Runs `src/tests/system.full.test.ts`. If the 130-scenario E2E test fails (e.g., a logic bug allowed a withdrawal without a deposit), the PR is heavily blocked.

## 3. Continuous Deployment (CD) Pipeline

Apex Arena deploys using an immutable infrastructure strategy via AWS CodePipeline.

### 3.1 Staging Deployment (Trigger on Push to `main`)
1. **Build Docker Image:** The application is containerized.
2. **Push to Amazon ECR:** The image is tagged with the Git commit hash.
3. **Deploy to ECS/EC2 Staging:** The staging Auto Scaling Group pulls the new image.
4. **E2E Smoke Test:** Automated Playwright scripts run against `stage.apexarena.in` simulating a full tournament lifecycle using Cashfree Sandbox UPI.
5. **Slack Notification:** Sends an alert to the `#devops` channel that Staging is healthy.

### 3.2 Production Release (Manual Trigger)
Production deployments are manually triggered to prevent Friday-evening automated releases crashing live money games.
1. **Approval Gate:** The CTO or Release Manager must click "Approve" in the AWS Console.
2. **Zero-Downtime Rollout:** AWS ALB utilizes a Rolling Update strategy. It spins up 2 new EC2 instances with the latest Docker image. Only when those nodes pass the `/api/health` check (200 OK) does the ALB redirect traffic to them and drain/terminate the old instances.
3. **Rollback Trigger:** If error rates (HTTP 500s) spike beyond 2% within 5 minutes of a deployment, AWS automatically reverts the Auto Scaling Group back to the previous stable Docker image.
