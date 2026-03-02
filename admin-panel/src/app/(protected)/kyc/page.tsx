'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, KycResponse, KycSubmission } from '@/lib/types';
import { PageLoader } from '@/components/LoadingSpinner';
import ErrorAlert from '@/components/ErrorAlert';
import StatusBadge from '@/components/StatusBadge';
import PaginationControls from '@/components/Pagination';
import Modal from '@/components/Modal';
import { Loader2, CheckCircle2, XCircle, FileText } from 'lucide-react';

type KycFilter = 'submitted' | 'verified' | 'rejected' | '';

export default function KycPage() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<KycFilter>('submitted');
    const [approveModal, setApproveModal] = useState<KycSubmission | null>(null);
    const [rejectModal, setRejectModal] = useState<KycSubmission | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const { data, isLoading, error } = useQuery({
        queryKey: ['kyc', page, statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams({ page: String(page), limit: '20' });
            if (statusFilter) params.set('status', statusFilter);
            const res = await api.get<ApiResponse<KycResponse>>(`/admin/kyc?${params}`);
            return res.data.data;
        },
    });

    const approveMutation = useMutation({
        mutationFn: async (userId: string) => {
            await api.post(`/admin/kyc/${userId}/approve`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kyc'] });
            setApproveModal(null);
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
            await api.post(`/admin/kyc/${userId}/reject`, { reason });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kyc'] });
            setRejectModal(null);
            setRejectReason('');
        },
    });

    const filters: { value: KycFilter; label: string }[] = [
        { value: 'submitted', label: 'Pending Review' },
        { value: 'verified', label: 'Verified' },
        { value: 'rejected', label: 'Rejected' },
        { value: '', label: 'All' },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">KYC Verification</h1>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
                {filters.map((f) => (
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
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Mobile</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Email</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Doc Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Doc Number</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Fraud</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Submitted</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {data.submissions.map((s) => (
                                    <tr key={s.id} className="transition-colors hover:bg-zinc-800/30">
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-300">{s.mobile}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">{s.email ?? '—'}</td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <span className="flex items-center gap-1.5 text-sm text-zinc-300">
                                                <FileText className="h-3.5 w-3.5 text-zinc-500" />
                                                {s.kycDocType}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-zinc-400">{s.kycDocNumber}</td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <span className={`text-sm font-medium ${s.fraudScore >= 80 ? 'text-red-400' : s.fraudScore >= 50 ? 'text-amber-400' : 'text-zinc-400'}`}>
                                                {s.fraudScore}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={s.kycStatus} /></td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-500">
                                            {new Date(s.updatedAt).toLocaleString()}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            {s.kycStatus === 'submitted' && (
                                                <div className="flex justify-end gap-1">
                                                    <button
                                                        onClick={() => setApproveModal(s)}
                                                        className="flex items-center gap-1 rounded-lg bg-emerald-600/20 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-600/30"
                                                    >
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => setRejectModal(s)}
                                                        className="flex items-center gap-1 rounded-lg bg-red-600/20 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-600/30"
                                                    >
                                                        <XCircle className="h-3 w-3" />
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {data.submissions.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-sm text-zinc-500">
                                            No KYC submissions found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls pagination={data.pagination} onPageChange={setPage} />
                </div>
            )}

            {/* Approve Modal */}
            {approveModal && (
                <Modal open onClose={() => setApproveModal(null)} title="Approve KYC">
                    <p className="text-sm text-zinc-400">
                        Approve KYC for user <strong className="text-white">{approveModal.mobile}</strong>?
                    </p>
                    <p className="mt-2 text-sm text-zinc-500">
                        Document: {approveModal.kycDocType} — {approveModal.kycDocNumber}
                    </p>
                    {approveMutation.error && <div className="mt-3"><ErrorAlert error={approveMutation.error as Error} /></div>}
                    <div className="mt-6 flex justify-end gap-3">
                        <button onClick={() => setApproveModal(null)} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800">Cancel</button>
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

            {/* Reject Modal */}
            {rejectModal && (
                <Modal open onClose={() => { setRejectModal(null); setRejectReason(''); }} title="Reject KYC">
                    <div className="space-y-3">
                        <p className="text-sm text-zinc-400">
                            Reject KYC for <strong className="text-white">{rejectModal.mobile}</strong>?
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
                                placeholder="Reason for rejection..."
                            />
                        </div>
                        {rejectMutation.error && <ErrorAlert error={rejectMutation.error as Error} />}
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                        <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800">Cancel</button>
                        <button
                            onClick={() => rejectMutation.mutate({ userId: rejectModal.id, reason: rejectReason })}
                            disabled={rejectMutation.isPending || !rejectReason.trim()}
                            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
                        >
                            {rejectMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Confirm Reject
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
