'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
    ApiResponse,
    WithdrawalsResponse,
    Withdrawal,
    WithdrawalProcessRequest,
    WithdrawalProcessResult,
} from '@/lib/types';
import { PageLoader } from '@/components/LoadingSpinner';
import ErrorAlert from '@/components/ErrorAlert';
import StatusBadge from '@/components/StatusBadge';
import PaginationControls from '@/components/Pagination';
import Modal from '@/components/Modal';
import { Loader2, ShieldAlert, CheckCircle2, XCircle, Banknote } from 'lucide-react';

type StatusFilter = 'requested' | 'under_review' | 'approved' | 'paid' | 'rejected' | 'failed' | '';

export default function WithdrawalsPage() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('requested');

    // Approval / Reject state
    const [approveModal, setApproveModal] = useState<Withdrawal | null>(null);
    const [rejectModal, setRejectModal] = useState<Withdrawal | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    // Payout state
    const [payoutModal, setPayoutModal] = useState<Withdrawal | null>(null);
    const [twoFaToken, setTwoFaToken] = useState('');

    const { data, isLoading, error } = useQuery({
        queryKey: ['withdrawals', page, statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams({ page: String(page), limit: '20' });
            if (statusFilter) params.set('status', statusFilter);
            const res = await api.get<ApiResponse<WithdrawalsResponse>>(`/admin/withdrawals?${params}`);
            return res.data.data;
        },
    });

    // ── Approve Mutation ────────────────────────────────────
    const approveMutation = useMutation({
        mutationFn: async (withdrawalId: string) => {
            const body: WithdrawalProcessRequest = { withdrawalId, action: 'approve' };
            const res = await api.post<ApiResponse<WithdrawalProcessResult>>('/admin/withdrawals/process', body);
            return res.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            setApproveModal(null);
        },
    });

    // ── Reject Mutation ─────────────────────────────────────
    const rejectMutation = useMutation({
        mutationFn: async ({ withdrawalId, notes }: { withdrawalId: string; notes: string }) => {
            const body: WithdrawalProcessRequest = { withdrawalId, action: 'reject', notes };
            await api.post('/admin/withdrawals/process', body);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            setRejectModal(null);
            setRejectReason('');
        },
    });

    // ── Payout Mutation ─────────────────────────────────────
    const payoutMutation = useMutation({
        mutationFn: async ({ withdrawalId, token }: { withdrawalId: string; token: string }) => {
            await api.post(`/admin/withdrawals/payout/${withdrawalId}`, {}, {
                headers: { 'x-2fa-token': token },
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            setPayoutModal(null);
            setTwoFaToken('');
        },
    });

    const isProcessable = (w: Withdrawal) =>
        w.status === 'requested' || w.status === 'under_review';

    const isPayable = (w: Withdrawal) => w.status === 'approved';

    const statusFilters: { value: StatusFilter; label: string }[] = [
        { value: 'requested', label: 'Requested' },
        { value: 'under_review', label: 'Under Review' },
        { value: 'approved', label: 'Approved' },
        { value: 'paid', label: 'Paid' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'failed', label: 'Failed' },
        { value: '', label: 'All' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Withdrawals</h1>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap gap-2">
                {statusFilters.map((f) => (
                    <button
                        key={f.value}
                        onClick={() => { setStatusFilter(f.value); setPage(1); }}
                        className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === f.value
                                ? 'bg-indigo-600 text-white'
                                : 'border border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {isLoading && <PageLoader />}
            {error && <ErrorAlert error={error as Error} />}

            {data && (
                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-zinc-800">
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">User</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Amount</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">TDS</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Net</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Fraud</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">KYC</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Requested</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {data.withdrawals.map((w) => (
                                    <tr key={w.id} className="transition-colors hover:bg-zinc-800/30">
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-300">
                                            {w.user.mobile}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-white">
                                            ₹{Number(w.amount).toLocaleString()}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-500">
                                            ₹{Number(w.tdsAmount).toLocaleString()}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-emerald-400">
                                            ₹{Number(w.netAmount ?? 0).toLocaleString()}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <span className={`flex items-center gap-1 text-sm font-medium ${w.fraudScoreSnapshot >= 80 ? 'text-red-400' : w.fraudScoreSnapshot >= 50 ? 'text-amber-400' : 'text-zinc-400'
                                                }`}>
                                                {w.fraudScoreSnapshot >= 80 && <ShieldAlert className="h-3.5 w-3.5" />}
                                                {w.fraudScoreSnapshot}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <StatusBadge status={w.user.kycStatus} />
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <StatusBadge status={w.status} />
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-500">
                                            {new Date(w.createdAt).toLocaleString()}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <div className="flex justify-end gap-1">
                                                {isProcessable(w) && (
                                                    <>
                                                        <button
                                                            onClick={() => setApproveModal(w)}
                                                            className="flex items-center gap-1 rounded-lg bg-emerald-600/20 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30"
                                                        >
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => setRejectModal(w)}
                                                            className="flex items-center gap-1 rounded-lg bg-red-600/20 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-600/30"
                                                        >
                                                            <XCircle className="h-3 w-3" />
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                {isPayable(w) && (
                                                    <button
                                                        onClick={() => setPayoutModal(w)}
                                                        className="flex items-center gap-1 rounded-lg bg-indigo-600/20 px-2.5 py-1 text-xs font-medium text-indigo-400 hover:bg-indigo-600/30"
                                                    >
                                                        <Banknote className="h-3 w-3" />
                                                        Payout
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {data.withdrawals.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="py-12 text-center text-sm text-zinc-500">
                                            No withdrawals found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls pagination={data.pagination} onPageChange={setPage} />
                </div>
            )}

            {/* ── Approve Confirmation Modal ─────────────────────── */}
            {approveModal && (
                <Modal open onClose={() => setApproveModal(null)} title="Approve Withdrawal">
                    <div className="space-y-3">
                        <p className="text-sm text-zinc-400">
                            Confirm approval for <strong className="text-white">₹{Number(approveModal.amount).toLocaleString()}</strong> withdrawal
                            by user <strong className="text-white">{approveModal.user.mobile}</strong>?
                        </p>
                        {approveModal.fraudScoreSnapshot >= 50 && (
                            <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                                <ShieldAlert className="h-4 w-4" />
                                Fraud score: {approveModal.fraudScoreSnapshot} — Proceed with caution
                            </div>
                        )}
                        {approveMutation.error && <ErrorAlert error={approveMutation.error as Error} />}
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={() => setApproveModal(null)}
                            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => approveMutation.mutate(approveModal.id)}
                            disabled={approveMutation.isPending}
                            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                            {approveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Confirm Approve
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── Reject Modal (requires reason) ─────────────────── */}
            {rejectModal && (
                <Modal open onClose={() => { setRejectModal(null); setRejectReason(''); }} title="Reject Withdrawal">
                    <div className="space-y-3">
                        <p className="text-sm text-zinc-400">
                            Reject <strong className="text-white">₹{Number(rejectModal.amount).toLocaleString()}</strong> withdrawal
                            by <strong className="text-white">{rejectModal.user.mobile}</strong>?
                        </p>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-400">
                                Reason <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                rows={3}
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-red-500"
                                placeholder="Provide a reason for rejection..."
                            />
                        </div>
                        {rejectMutation.error && <ErrorAlert error={rejectMutation.error as Error} />}
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                        <button
                            onClick={() => { setRejectModal(null); setRejectReason(''); }}
                            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() =>
                                rejectMutation.mutate({
                                    withdrawalId: rejectModal.id,
                                    notes: rejectReason,
                                })
                            }
                            disabled={rejectMutation.isPending || !rejectReason.trim()}
                            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
                        >
                            {rejectMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Confirm Reject
                        </button>
                    </div>
                </Modal>
            )}

            {/* ── Payout Modal (requires 2FA) ────────────────────── */}
            {payoutModal && (
                <Modal open onClose={() => { setPayoutModal(null); setTwoFaToken(''); }} title="Trigger Payout">
                    <div className="space-y-3">
                        <p className="text-sm text-zinc-400">
                            Trigger payout of <strong className="text-emerald-400">₹{Number(payoutModal.netAmount ?? 0).toLocaleString()}</strong> to
                            user <strong className="text-white">{payoutModal.user.mobile}</strong>?
                        </p>
                        <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                            This action requires your 2FA token and cannot be undone.
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-400">
                                2FA Token <span className="text-red-400">*</span>
                            </label>
                            <input
                                value={twoFaToken}
                                onChange={(e) => setTwoFaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                type="text"
                                maxLength={6}
                                placeholder="000000"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-center text-lg font-mono tracking-[0.5em] text-white outline-none focus:border-indigo-500"
                            />
                        </div>
                        {payoutMutation.error && <ErrorAlert error={payoutMutation.error as Error} />}
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                        <button
                            onClick={() => { setPayoutModal(null); setTwoFaToken(''); }}
                            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() =>
                                payoutMutation.mutate({
                                    withdrawalId: payoutModal.id,
                                    token: twoFaToken,
                                })
                            }
                            disabled={payoutMutation.isPending || twoFaToken.length !== 6}
                            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                        >
                            {payoutMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Execute Payout
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
