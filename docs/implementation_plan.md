# MVP User Frontend Implementation Plan

## Proposed Changes

### Setup and Infrastructure
- Initialize Next.js 14 with TypeScript and TailwindCSS.
- Setup Axios with global interceptors. Handle timeouts specifically ("Network issue. Please retry."). On 401, dispatch session expiration toast and redirect to `/login?returnUrl=/prior-path`.
- Implement robust toast logic to translate `409 Conflict` duplicate requests into "This action was already completed." instead of generic errors.

### Authentication
- `/register`: Strong password validation.
- `/login`: Email + Password. Successful login sets HTTP-only cookies and redirects to `/dashboard` (or `returnUrl`).
- `middleware.ts`: Protect active routes. Missing cookies -> redirect to `/login`.

### Dashboard & History
- `/dashboard`: Clearly distinguish and label "Total Balance" vs "Withdrawable Balance" (winning_balance) to prevent confusion.
- Include Deposit, Withdraw, and Join Tournament buttons. Display last 10 wallet transactions.

### Wallet Safety & Flows
- **Deposit (`/wallet`)**:
  - Polling improvement: Poll every 5s for 30s *only* while status is Initiated or Pending. Stop polling immediately if status updates. If 30s elapsed and still Pending, show "Still pending. You can manually refresh." and provide a Refresh Status button. Never assume failure.
- **Withdraw (`/withdraw`)**:
  - Provide clarity around Withdrawable Balance. Disable buttons while checking KYC or executing withdrawal.

### Tournaments Functionality
- **List Page (`/tournaments`)**: Minimal layout.
- **Details Page (`/tournaments/[id]`)**:
  - Join UX: Disable button on click. On success, trigger refetches for both the user's wallet balance and the tournament details. Permanently disable button if already joined.
  - Result Submission: Validate image file strictly (max 5MB, Image/JPEG/PNG only) *before* hitting API. Do not expose storage URLs, only show backend-provided status. Hide/disable upload UI while uploading.

## Verification Plan
- Manual testing of network timeouts, 401 expiration flows, deposit manual refresh fallbacks, and idempotent join boundaries.
- Verify standard build using `npm run build`.
