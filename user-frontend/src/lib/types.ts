// Wallet
export interface WalletBalance {
    deposit_balance: number;
    winning_balance: number;
    total_balance: number;
}

// Transactions
export type TransactionType = 'deposit' | 'withdrawal' | 'prize' | 'entry_fee';
export type TransactionStatus = 'Initiated' | 'Pending' | 'Confirmed' | 'Failed' | 'Requested' | 'Under Review' | 'Approved' | 'Paid' | 'Rejected';

export interface Transaction {
    id: string;
    type: TransactionType;
    amount: number;
    status: TransactionStatus;
    created_at: string;
}

// KYC
export interface KycStatus {
    verified: boolean;
    status: 'pending' | 'verified' | 'rejected' | 'not_submitted';
}

// Wallet Info (combined)
export interface WalletInfo {
    balance: WalletBalance;
    kyc: KycStatus;
    cooldown_active?: boolean;
}

// Tournaments
export type TournamentStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface Tournament {
    id: string;
    title: string;
    format: '1v1';
    entry_fee: number;
    prize_pool: number;
    slots_total: number;
    slots_filled: number;
    start_time: string;
    status: TournamentStatus;
    is_joined?: boolean;
}

// Result Submission
export type ResultStatus = 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';

export interface TournamentResult {
    id: string;
    match_id: string;
    status: ResultStatus;
    submitted_at: string;
}
