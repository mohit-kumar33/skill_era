# Skill Era MVP User Frontend — Walkthrough

## Build Status: ✅ PASSED

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (11/11)
✓ Finalizing page optimization
Exit code: 0
```

---

## Project Location

`c:\Users\mohit\OneDrive\Desktop\again2\user-frontend`

## Pages Built

| Route | Type | Description |
|---|---|---|
| `/login` | Static | Cookie auth, returnUrl support, Suspense boundary |
| `/register` | Static | Strong password, mobile, Zod validation |
| `/dashboard` | Static | Balances (deposit vs winning), quick actions, recent 10 txns |
| `/wallet` | Static | Deposit flow, smart polling (30s cutoff + manual refresh) |
| `/withdraw` | Static | KYC/balance/cooldown gates, recent 5 withdrawals |
| `/tournaments` | Static | 1v1 list with entry fee, prize pool, slots, start time |
| `/tournaments/[id]` | Dynamic | Join flow (spinner, 409 handling, refetch both wallet+tournament), result upload |

---

## Key Financial Safety Features

### Deposit Flow
- Polls `/wallet/transactions?type=deposit` every **5 seconds for up to 30 seconds**
- Stops immediately when status changes from `Initiated/Pending`
- After 30s if still pending → shows **"Still pending. You can manually refresh."** with a manual button
- Never assumes success client-side

### Withdrawal Flow
- **Disables button** while checking KYC/balance
- Clearly shows **Withdrawable Balance** (winning_balance) vs deposit balance with explanatory label
- Disables if: KYC not verified, balance insufficient, or cooldown is active
- Backend error message displayed directly, button re-enabled on failure

### Tournament Join
- Button disabled immediately on click with spinner
- On 409 → `"This action was already completed."`
- On insufficient balance → explicit balance error
- On success → **refetches both wallet balance AND tournament details**

### Result Upload
- Client-side file validation: max **5MB**, JPEG/PNG only, error shown before submission
- Upload progress bar displayed
- Submit button disabled while uploading
- Only backend-provided status displayed (no storage URLs exposed)

---

## Global Safety Net
- **Axios interceptors** dispatch custom `window` events → `GlobalErrorHandler` listens:
  - `401` → Toast "Session expired" + redirect to `/login?returnUrl=...`
  - Network timeout → Toast "Network issue. Please retry."
  - `409` → Toast "This action was already completed."

---

## Config Required

Copy `.env.local.example` → `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

The backend must set a **`token` or `session` httpOnly cookie** after login, which the Middleware reads to protect routes.
