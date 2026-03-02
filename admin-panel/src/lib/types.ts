// ── API Response wrapper ─────────────────────────────────
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

// ── Pagination ───────────────────────────────────────────
export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedResponse<T> {
    pagination: Pagination;
    [key: string]: T[] | Pagination;
}

// ── User ─────────────────────────────────────────────────
export type AccountStatus = 'active' | 'suspended' | 'frozen' | 'banned';
export type KycStatus = 'pending' | 'submitted' | 'verified' | 'rejected';
export type UserRole = 'user' | 'admin' | 'finance_admin' | 'super_admin';

export interface AdminUser {
    id: string;
    mobile: string;
    email: string | null;
    role: UserRole;
    accountStatus: AccountStatus;
    kycStatus: KycStatus;
}

export interface User {
    id: string;
    mobile: string;
    email: string | null;
    accountStatus: AccountStatus;
    kycStatus: KycStatus;
    fraudScore: number;
    role: UserRole;
    state: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface UsersResponse {
    users: User[];
    pagination: Pagination;
}

// ── Auth ─────────────────────────────────────────────────
export interface LoginRequest {
    mobile: string;
    password: string;
}

export interface LoginResponse {
    user: AdminUser;
    tokens: {
        accessToken: string;
        refreshToken: string;
    };
}

// ── Dashboard ────────────────────────────────────────────
export interface DashboardStats {
    totalUsers: number;
    activeTournaments: number;
    pendingWithdrawals: number;
    revenueToday: string;
}

export interface TreasurySnapshot {
    totalUserBalance: string;
    pendingWithdrawals: string;
    liquidityRatio: string;
    timestamp: string;
}

// ── Withdrawal ───────────────────────────────────────────
export type WithdrawalStatus = 'requested' | 'under_review' | 'approved' | 'paid' | 'rejected' | 'failed';

export interface Withdrawal {
    id: string;
    userId: string;
    amount: string;
    status: WithdrawalStatus;
    fraudScoreSnapshot: number;
    tdsAmount: string;
    netAmount: string | null;
    adminApprovedBy: string | null;
    dualApprovedBy: string | null;
    adminNotes: string | null;
    createdAt: string;
    processedAt: string | null;
    user: {
        id: string;
        mobile: string;
        kycStatus: KycStatus;
        fraudScore: number;
        accountStatus: AccountStatus;
    };
}

export interface WithdrawalsResponse {
    withdrawals: Withdrawal[];
    pagination: Pagination;
}

export interface WithdrawalProcessRequest {
    withdrawalId: string;
    action: 'approve' | 'reject';
    notes?: string;
}

export interface WithdrawalProcessResult {
    withdrawalId: string;
    status: string;
    requiresDualApproval: boolean;
    dualApprovalComplete: boolean;
}

// ── Tournament ───────────────────────────────────────────
export type TournamentStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled';

export interface Tournament {
    id: string;
    gameType: string;
    title: string;
    entryFee: string;
    prizePool: string;
    commissionPercent: string;
    maxParticipants: number;
    status: TournamentStatus;
    scheduledAt: string;
    createdBy: string;
    createdAt: string;
    _count?: {
        participants: number;
    };
}

export interface TournamentsResponse {
    tournaments: Tournament[];
    pagination: Pagination;
}

export interface CreateTournamentRequest {
    title: string;
    gameType: string;
    entryFee: string;
    prizePool?: string;
    commissionPercent: number;
    maxParticipants: number;
    scheduledAt: string;
}

// ── KYC ──────────────────────────────────────────────────
export interface KycSubmission {
    id: string;
    mobile: string;
    email: string | null;
    kycStatus: KycStatus;
    kycDocType: string;
    kycDocNumber: string;
    kycDocUrl: string | null;
    fraudScore: number;
    createdAt: string;
    updatedAt: string;
}

export interface KycResponse {
    submissions: KycSubmission[];
    pagination: Pagination;
}

// ── Audit Log ────────────────────────────────────────────
export interface AuditLogEntry {
    id: string;
    adminId: string;
    actionType: string;
    targetUserId: string | null;
    ipAddress: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    admin: {
        id: string;
        mobile: string;
    };
    targetUser: {
        id: string;
        mobile: string;
    } | null;
}

export interface AuditLogResponse {
    logs: AuditLogEntry[];
    pagination: Pagination;
}
