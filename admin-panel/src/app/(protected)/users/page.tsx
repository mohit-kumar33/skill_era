'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, UsersResponse, User } from '@/lib/types';
import { PageLoader } from '@/components/LoadingSpinner';
import ErrorAlert from '@/components/ErrorAlert';
import StatusBadge from '@/components/StatusBadge';
import PaginationControls from '@/components/Pagination';
import Modal from '@/components/Modal';
import { Search, Ban, ShieldOff, Unlock, Loader2 } from 'lucide-react';

export default function UsersPage() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [actionModal, setActionModal] = useState<{
        user: User;
        action: 'suspend' | 'ban' | 'unfreeze';
    } | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['users', page, search],
        queryFn: async () => {
            const params = new URLSearchParams({ page: String(page), limit: '20' });
            if (search) params.set('search', search);
            const res = await api.get<ApiResponse<UsersResponse>>(`/admin/users?${params}`);
            return res.data.data;
        },
    });

    const actionMutation = useMutation({
        mutationFn: async ({ userId, action }: { userId: string; action: string }) => {
            await api.patch(`/admin/users/${userId}/${action}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setActionModal(null);
        },
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearch(searchInput);
        setPage(1);
    };

    const actionLabels = {
        suspend: { label: 'Suspend', color: 'bg-amber-600 hover:bg-amber-500', icon: ShieldOff },
        ban: { label: 'Ban', color: 'bg-red-600 hover:bg-red-500', icon: Ban },
        unfreeze: { label: 'Unfreeze', color: 'bg-emerald-600 hover:bg-emerald-500', icon: Unlock },
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Users</h1>
                <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search by mobile or email..."
                            className="rounded-xl border border-zinc-700 bg-zinc-800/50 py-2 pl-9 pr-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500"
                        />
                    </div>
                    <button
                        type="submit"
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                        Search
                    </button>
                </form>
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
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">KYC</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Fraud</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Role</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Joined</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {data.users.map((user) => (
                                    <tr key={user.id} className="transition-colors hover:bg-zinc-800/30">
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-300">{user.mobile}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">{user.email ?? '—'}</td>
                                        <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={user.accountStatus} /></td>
                                        <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={user.kycStatus} /></td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <span className={`text-sm font-medium ${user.fraudScore >= 80 ? 'text-red-400' : user.fraudScore >= 50 ? 'text-amber-400' : 'text-zinc-400'}`}>
                                                {user.fraudScore}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">{user.role}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-500">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right">
                                            {user.role === 'user' && (
                                                <div className="flex justify-end gap-1">
                                                    {user.accountStatus === 'active' && (
                                                        <>
                                                            <ActionBtn
                                                                onClick={() => setActionModal({ user, action: 'suspend' })}
                                                                label="Suspend"
                                                                className="text-amber-400 hover:bg-amber-500/10"
                                                            />
                                                            <ActionBtn
                                                                onClick={() => setActionModal({ user, action: 'ban' })}
                                                                label="Ban"
                                                                className="text-red-400 hover:bg-red-500/10"
                                                            />
                                                        </>
                                                    )}
                                                    {(user.accountStatus === 'suspended' || user.accountStatus === 'frozen') && (
                                                        <ActionBtn
                                                            onClick={() => setActionModal({ user, action: 'unfreeze' })}
                                                            label="Unfreeze"
                                                            className="text-emerald-400 hover:bg-emerald-500/10"
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls pagination={data.pagination} onPageChange={setPage} />
                </div>
            )}

            {/* Confirmation Modal */}
            {actionModal && (
                <Modal
                    open
                    onClose={() => setActionModal(null)}
                    title={`${actionLabels[actionModal.action].label} User`}
                >
                    <p className="text-sm text-zinc-400">
                        Are you sure you want to <strong className="text-white">{actionModal.action}</strong> user{' '}
                        <strong className="text-white">{actionModal.user.mobile}</strong>?
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={() => setActionModal(null)}
                            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() =>
                                actionMutation.mutate({
                                    userId: actionModal.user.id,
                                    action: actionModal.action,
                                })
                            }
                            disabled={actionMutation.isPending}
                            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white ${actionLabels[actionModal.action].color} disabled:opacity-60`}
                        >
                            {actionMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Confirm {actionLabels[actionModal.action].label}
                        </button>
                    </div>
                    {actionMutation.error && (
                        <div className="mt-3">
                            <ErrorAlert error={actionMutation.error as Error} />
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
}

function ActionBtn({ onClick, label, className }: { onClick: () => void; label: string; className: string }) {
    return (
        <button
            onClick={onClick}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${className}`}
        >
            {label}
        </button>
    );
}
