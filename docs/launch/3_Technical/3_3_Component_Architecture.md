# 3.3 Component Architecture

**Project Name:** Apex Arena (MVP)  
**Document Owner:** Full Stack Architect  
**Version:** 1.0.0  

---

## 1. Backend Service Modularity (Fastify / TypeScript)
The backend does not use microservices over the network, but it strictly simulates microservice boundaries inside the codebase via Fastify encapsulation.

```
/src
 ├── /config           (Environment vars, AWS clients, Redis)
 ├── /docs             (Swagger/OpenAPI UI generation)
 ├── /lib              (Shared utils: hashing, custom errors, precision math)
 ├── /modules
 │    ├── /auth        (JWT, Turnstile, Bcrypt)
 │    ├── /user        (Profile, KYC validation wrapper)
 │    ├── /wallet      (Deposit, Withdraw, Ledger, Gateway Webhooks)
 │    ├── /tournament  (Matchmaking, Entry Fee collection, Results logic)
 │    └── /gameplay    (Chess validation engine, WebSockets)
 ├── /plugins          (JWT parsing, User mapping, Error handlers)
 └── server.ts         (Fastify Bootstrapper)
```

**Rule of Segregation:**
The `tournament` module is NEVER allowed to execute `prisma.user.update` to change a balance. It must call a strict interface inside `walletService.deductFunds(userId, amount)`. This guarantees all financial logic is isolated in one folder.

## 2. Frontend Component Modularity (Next.js / React)
The frontend utilizes Next.js App Router for Server Components (SEO and initial load speed) and Client Components (Interactivity).

```
/user-frontend/src
 ├── /app
 │    ├── /dashboard     (Protected user portal)
 │    ├── /tournaments   (Lobby list and matchmaking screens)
 │    ├── /play          (Live chess board interface)
 │    └── /wallet        (Deposit/Withdraw UI)
 ├── /components
 │    ├── /ui            (Atomic elements: Buttons, Inputs, Modals)
 │    ├── /chess         (React-chessboard wrapper, piece SVG assets)
 │    └── /forms         (Zod + react-hook-form wrappers)
 ├── /lib
 │    ├── axios.ts       (API interceptor attaching JWT Tokens)
 │    ├── schemas.ts     (Shared Zod validations)
 │    └── types.ts       (TypeScript interfaces mirroring Prisma)
 └── /hooks
      ├── useChess.ts    (Socket.io listener abstractions)
      └── useWallet.ts   (React Query polling for balance updates)
```

## 3. Communication Pathways 
### REST over HTTPS (The default)
- JSON payloads mapped against strict Zod validation schemas.
- Typical response structure: `{"success": true, "data": {...}, "error": null}`.

### WebSockets (TCP/IP)
- Used exclusively within the `/play` route.
- Used for `MOVE_PIECE`, `OFFER_DRAW`, `RESIGN`, and `CLOCK_TICK_SYNC` events.
- Ping/Pong heartbeats every 15 seconds to drop dead connections.
