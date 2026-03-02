# Apex Arena - Cloud Deployment Guide (Netlify + Render)

This architecture completely separates your static frontends (Netlify App Router) from your stateful transactional backend (Render Fastify + PostgreSQL) to ensure zero-downtime scalability and maximum security.

## Step 1: Push Source Code to GitHub
Ensure the entire `again2` monorepo is pushed to a private GitHub repository.
Both Netlify and Render will use this single repository for Automated CI/CD.

## Step 2: Deploy Backend & Database (Render.com)
The Fastify backend and PostgreSQL database are defined by the Infrastructure-as-Code `render.yaml` file located in your root directory.

1. Create an account at [Render.com](https://render.com) and link your GitHub.
2. Click **New +** -> **Blueprint**.
3. Select your `again2` GitHub repository.
4. Render will automatically parse the `render.yaml` and provision two resources:
   - `apex-postgres` (Managed Database)
   - `apex-backend` (Web Service)
5. **Critical Security Step:** Once provisioned, open the **Environment** tab on the `apex-backend` service and manually inject the `sync: false` secrets (e.g., `CASHFREE_SECRET_KEY`, `JWT_SECRET`). 

## Step 3: Deploy User Frontend (Netlify)
The User Frontend Next.js app is deployed to Netlify optimized for the App Router.

1. Create an account at [Netlify.com](https://app.netlify.com/signup) and link your GitHub.
2. Click **Add new site** -> **Import an existing project**.
3. Select the `again2` repository.
4. **Build settings overrides (Crucial for Monorepo):**
   - Base directory: `user-frontend`
   - Build command: `npm run build`
   - Publish directory: `.next`
5. Click **Deploy Site**.
6. **Post-Deploy:** Change the `NEXT_PUBLIC_API_URL` environment variable in Netlify to point to your new Render Backend HTTPS URL (e.g., `https://apex-backend-xyz.onrender.com`).

## Step 4: Deploy Admin Panel (Netlify)
The Admin Panel is a completely isolated Next.js app with distinct security headers.

1. Follow the exact same Netlify import steps as above.
2. **Build settings overrides:**
   - Base directory: `admin-panel`
   - Build command: `npm run build`
   - Publish directory: `.next`
3. Click **Deploy Site**.
4. Set the `NEXT_PUBLIC_API_URL` environment variable identically to the Render Backend URL.

---

### Understanding the `.toml` / `.yaml` Configurations

- **`render.yaml`**: Ensures that Render automatically provisions a PostgreSQL 16 database, links it via `DATABASE_URL` internally to the Fastify worker, and scales the worker out of Singapore (the lowest latency available node to India outside of AWS Mumbai).
- **`netlify.toml`**: Instructs Netlify's Edge CDN to inject strict financial-grade security headers (`Strict-Transport-Security`, `X-XSS-Protection`, etc.) into every single HTTP response before it hits a user's browser, blocking entire categories of client-side injection attacks.
