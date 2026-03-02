import type { AccountStatus, KycStatus, WithdrawalStatus, TournamentStatus } from '@/lib/types';

type BadgeStatus = AccountStatus | KycStatus | WithdrawalStatus | TournamentStatus | string;

const colorMap: Record<string, string> = {
    // Account
    active: 'bg-emerald-500/20 text-emerald-400',
    suspended: 'bg-amber-500/20 text-amber-400',
    frozen: 'bg-blue-500/20 text-blue-400',
    banned: 'bg-red-500/20 text-red-400',
    // KYC
    pending: 'bg-zinc-500/20 text-zinc-400',
    submitted: 'bg-amber-500/20 text-amber-400',
    verified: 'bg-emerald-500/20 text-emerald-400',
    rejected: 'bg-red-500/20 text-red-400',
    // Withdrawal
    requested: 'bg-amber-500/20 text-amber-400',
    under_review: 'bg-indigo-500/20 text-indigo-400',
    approved: 'bg-cyan-500/20 text-cyan-400',
    paid: 'bg-emerald-500/20 text-emerald-400',
    failed: 'bg-red-500/20 text-red-400',
    // Tournament
    draft: 'bg-zinc-500/20 text-zinc-400',
    open: 'bg-emerald-500/20 text-emerald-400',
    in_progress: 'bg-indigo-500/20 text-indigo-400',
    completed: 'bg-zinc-500/20 text-zinc-300',
    cancelled: 'bg-red-500/20 text-red-400',
};

export default function StatusBadge({ status }: { status: BadgeStatus }) {
    const colors = colorMap[status] ?? 'bg-zinc-500/20 text-zinc-400';
    return (
        <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${colors}`}>
            {status.replace(/_/g, ' ')}
        </span>
    );
}
