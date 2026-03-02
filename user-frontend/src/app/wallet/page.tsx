'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { Transaction } from '@/lib/types';
import { Loader2, RefreshCw } from 'lucide-react';

async function fetchDepositTransactions(): Promise<Transaction[]> {
    const res = await api.get('/wallet/transactions?limit=50');
    const txs = res.data?.data?.transactions || [];
    return txs
        .filter((t: Record<string, any>) => t.transactionType === 'DEPOSIT')
        .slice(0, 5)
        .map((t: Record<string, any>) => ({
            id: t.id,
            type: 'deposit',
            amount: parseFloat(t.creditAmount || '0'),
            status: t.status,
            created_at: t.createdAt,
        }));
}

function statusColor(status: string) {
    switch (status) {
        case 'Confirmed': return 'text-green-600 bg-green-50';
        case 'Failed': return 'text-red-600 bg-red-50';
        case 'Pending': case 'Initiated': return 'text-amber-600 bg-amber-50';
        default: return 'text-gray-600 bg-gray-100';
    }
}

export default function WalletPage() {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState('');
    const [amountError, setAmountError] = useState('');
    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState('');
    const [pollTimedOut, setPollTimedOut] = useState(false);

    const { data: deposits, refetch: refetchDeposits, isLoading: txLoading } = useQuery({
        queryKey: ['deposits'],
        queryFn: fetchDepositTransactions,
    });

    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    }, []);

    const startPolling = useCallback(() => {
        setPollTimedOut(false);
        stopPolling();

        pollIntervalRef.current = setInterval(async () => {
            await refetchDeposits();
            const current = queryClient.getQueryData<Transaction[]>(['deposits']);
            const hasPending = current?.some((t) => t.status === 'Initiated' || t.status === 'Pending');
            if (!hasPending) {
                stopPolling();
                queryClient.invalidateQueries({ queryKey: ['wallet'] });
            }
        }, 5000);

        pollTimeoutRef.current = setTimeout(() => {
            stopPolling();
            const current = queryClient.getQueryData<Transaction[]>(['deposits']);
            const hasPending = current?.some((t) => t.status === 'Initiated' || t.status === 'Pending');
            if (hasPending) setPollTimedOut(true);
        }, 30000);
    }, [refetchDeposits, stopPolling, queryClient]);

    useEffect(() => {
        if (deposits) {
            const hasPending = deposits.some((t) => t.status === 'Initiated' || t.status === 'Pending');
            if (hasPending) startPolling();
        }
        return () => stopPolling();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const validate = (): number | null => {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) {
            setAmountError('Please enter a valid amount.');
            return null;
        }
        if (parsed < 100) {
            setAmountError('Minimum deposit is ₹100.');
            return null;
        }
        setAmountError('');
        return parsed;
    };

    const onDeposit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = validate();
        if (parsed === null) return;
        try {
            setLoading(true);
            setServerError('');
            const res = await api.post('/wallet/deposit/initiate', { amount: parsed });
            setAmount('');
            const paymentUrl = res.data?.paymentUrl as string | undefined;
            if (paymentUrl) {
                await refetchDeposits();
                startPolling();
                window.location.href = paymentUrl;
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            setServerError(err.response?.data?.message || 'Failed to initiate deposit.');
        } finally {
            setLoading(false);
        }
    };

    const handleManualRefresh = async () => {
        setPollTimedOut(false);
        await refetchDeposits();
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Deposit Funds</h1>
                    <p className="text-sm text-gray-500 mt-1">Add money to your deposit balance</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    {serverError && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {serverError}
                        </div>
                    )}
                    <form onSubmit={onDeposit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => { setAmount(e.target.value); setAmountError(''); }}
                                disabled={loading}
                                min={100}
                                className={`w-full px-4 py-2 rounded-xl border ${amountError ? 'border-red-300' : 'border-gray-200'
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                placeholder="Minimum ₹100"
                            />
                            {amountError && <p className="text-red-500 text-xs mt-1">{amountError}</p>}
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Proceed to Payment'}
                        </button>
                    </form>
                </div>

                {pollTimedOut && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start justify-between gap-4">
                        <p className="text-amber-700 text-sm">
                            Still pending. Your payment may still be processing. You can manually refresh to check.
                        </p>
                        <button
                            onClick={handleManualRefresh}
                            className="flex items-center gap-1 text-amber-700 font-medium text-sm whitespace-nowrap hover:underline"
                        >
                            <RefreshCw className="w-4 h-4" /> Refresh Status
                        </button>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Deposits</h2>
                        <button onClick={() => refetchDeposits()} className="text-gray-400 hover:text-gray-600 transition-colors" title="Refresh">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    {txLoading ? (
                        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                    ) : !deposits || deposits.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-4">No deposits yet.</p>
                    ) : (
                        <div className="divide-y divide-gray-50 -mx-2">
                            {deposits.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between px-2 py-3">
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">₹{tx.amount.toFixed(2)}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {new Date(tx.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(tx.status)}`}>
                                        {tx.status}
                                        {(tx.status === 'Initiated' || tx.status === 'Pending') && (
                                            <span className="ml-1">· Pending confirmation</span>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
