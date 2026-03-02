'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, AuditLogResponse } from '@/lib/types';
import { PageLoader } from '@/components/LoadingSpinner';
import ErrorAlert from '@/components/ErrorAlert';
import PaginationControls from '@/components/Pagination';
import { Clock, User, Shield } from 'lucide-react';

export default function AuditLogPage() {
    const [page, setPage] = useState(1);

    const { data, isLoading, error } = useQuery({
        queryKey: ['audit-log', page],
        queryFn: async () => {
            const res = await api.get<ApiResponse<AuditLogResponse>>(
                `/admin/audit-log?page=${page}&limit=30`
            );
            return res.data.data;
        },
    });

    const actionColors: Record<string, string> = {
        WITHDRAWAL_APPROVED: 'text-emerald-400',
        WITHDRAWAL_REJECTED: 'text-red-400',
        PAYOUT_INITIATED: 'text-indigo-400',
        PAYOUT_SUCCESS: 'text-emerald-400',
        PAYOUT_FAILED: 'text-red-400',
        KYC_APPROVE: 'text-emerald-400',
        KYC_REJECT: 'text-red-400',
        USER_SUSPEND: 'text-amber-400',
        USER_BAN: 'text-red-400',
        USER_UNFREEZE: 'text-emerald-400',
        FRAUD_FLAG_ADDED: 'text-orange-400',
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Audit Log</h1>

            {isLoading && <PageLoader />}
            {error && <ErrorAlert error={error as Error} />}

            {data && (
                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
                    <div className="divide-y divide-zinc-800/50">
                        {data.logs.map((log) => (
                            <div key={log.id} className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-zinc-800/20">
                                <div className="mt-0.5 rounded-lg bg-zinc-800 p-2">
                                    <Shield className="h-4 w-4 text-zinc-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-semibold ${actionColors[log.actionType] ?? 'text-zinc-300'}`}>
                                            {log.actionType.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                                        <span className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            Admin: {log.admin?.mobile ?? log.adminId.slice(0, 8)}
                                        </span>
                                        {log.targetUser && (
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                Target: {log.targetUser.mobile}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {new Date(log.createdAt).toLocaleString()}
                                        </span>
                                        {log.ipAddress && (
                                            <span className="text-zinc-600">IP: {log.ipAddress}</span>
                                        )}
                                    </div>
                                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                                        <div className="mt-2 rounded-lg bg-zinc-800/50 px-3 py-2">
                                            <pre className="overflow-x-auto text-xs text-zinc-500">
                                                {JSON.stringify(log.metadata, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {data.logs.length === 0 && (
                            <div className="py-12 text-center text-sm text-zinc-500">
                                No audit logs found
                            </div>
                        )}
                    </div>
                    <PaginationControls pagination={data.pagination} onPageChange={setPage} />
                </div>
            )}
        </div>
    );
}
