# 3.4 API Specification (Core Endpoints)

**Project Name:** Apex Arena (MVP)  
**Document Owner:** API Design Team  
**Version:** 1.0.0  

---

*This document outlines the structured contracts for the most financially critical endpoints. Full OpenAPI/Swagger definition is generated dynamically via Fastify at `<server-url>/docs`.*

## 1. Authentication Domain

### `POST /api/auth/register`
- **Purpose:** Create a new user account.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123!",
    "cfTurnstileResponse": "0.xx...token"
  }
  ```
- **Responses:**
  - `201 Created`: Returns `{ "token": "jwt..." }`
  - `400 Bad Request`: "Invalid Captcha" or "Password too weak"
  - `409 Conflict`: "Email already exists"

## 2. Wallet & Financial Domain

### `POST /api/wallet/deposit/initiate`
- **Purpose:** Request a Cashfree checkout session to add funds.
- **Headers:** `Authorization: Bearer <jwt>`
- **Request Body:**
  ```json
  {
    "amount": 500,
    "currency": "INR"
  }
  ```
- **Responses:**
  - `200 OK`: Returns Cashfree `payment_session_id` and generated `order_id`.

### `POST /api/webhooks/cashfree` (CRITICAL)
- **Purpose:** Receive asynchronous confirmation of deposits from Cashfree.
- **Headers:** `x-webhook-signature` (HMAC validation required).
- **Request Body:** (Cashfree Standard Webhook Payload)
- **Action:** If `payment_status == SUCCESS`, find transaction by `order_id`, securely lock rows, credit `DepositBalance`.
- **Responses:**
  - `200 OK`: Acknowledge receipt to stop Cashfree from retrying.

### `POST /api/wallet/withdraw/request`
- **Purpose:** User initiates extraction of Winning Balance.
- **Headers:** `Authorization: Bearer <jwt>`, `X-Idempotency-Key: <uuid>`
- **Request Body:**
  ```json
  {
    "amount": 250,
    "bankAccountId": "uuid-from-kyc"
  }
  ```
- **Action:**
  1. Validates KYC is `VERIFIED`.
  2. Blocks if last deposit was `< 24 hours` ago.
  3. Validates `WinningBalance >= 250`.
  4. Creates `Withdrawal` record (Pending) and calculates `TDS_Amount`.
- **Responses:**
  - `200 OK`: Withdrawal queued for manual review.

## 3. Tournament Domain

### `POST /api/tournaments/:id/join`
- **Purpose:** Sit down at a 1v1 match and escrow entry fee.
- **Headers:** `Authorization: Bearer <jwt>`, `X-Idempotency-Key: <uuid>`
- **Action:**
  - Row-lock User and deduct Entry Fee.
  - Insert user ID into `Participant` table.
  - If `Participant` count == `MaxParticipants` (2), lock tournament and trigger WebSocket broadcast `MATCH_READY`.
- **Responses:**
  - `200 OK`: Joined successfully. Waiting for opponent.
  - `400 Bad Request`: "Insufficient funds" or "Tournament Full".
