'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { WalletInfo, Transaction } from '@/lib/types';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

async function fetchWalletInfo(): Promise<WalletInfo> {
    const res = await api.get('/wallet/balance');
    const d = res.data?.data || {};
    return {
        balance: {
            deposit_balance: parseFloat(d.depositBalance || '0'),
            winning_balance: parseFloat(d.winningBalance || '0'),
            total_balance: parseFloat(d.totalBalance || '0'),
        },
        kyc: { verified: true, status: 'verified' },
    };
}

async function fetchWithdrawals(): Promise<Transaction[]> {
    const res = await api.get('/wallet/transactions?limit=50');
    const txs = res.data?.data?.transactions || [];
    return txs
        .filter((t: Record<string, any>) => t.transactionType === 'WITHDRAWAL')
        .slice(0, 5)
        .map((t: Record<string, any>) => ({
            id: t.id,
            type: 'withdrawal',
            amount: parseFloat(t.debitAmount || '0'),
            status: t.status,
            created_at: t.createdAt,
        }));
}

function statusColor(status: string) {
    switch (status) {
        case 'Paid': case 'Approved': return 'text-green-600 bg-green-50';
        case 'Rejected': return 'text-red-600 bg-red-50';
        case 'Requested': case 'Under Review': return 'text-amber-600 bg-amber-50';
        default: return 'text-gray-600 bg-gray-100';
    }
}

export default function WithdrawPage() {
    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState('');
    const [amountError, setAmountError] = useState('');
    const [serverError, setServerError] = useState('');
    const [success, setSuccess] = useState('');

    const { data: walletInfo, isLoading: walletLoading } = useQuery({
        queryKey: ['wallet'],
        queryFn: fetchWalletInfo,
    });

    const { data: withdrawals, isLoading: wxLoading, refetch: refetchWithdrawals } = useQuery({
        queryKey: ['withdrawals'],
        queryFn: fetchWithdrawals,
    });

    const winningBalance = walletInfo?.balance?.winning_balance ?? 0;
    const kycVerified = walletInfo?.kyc?.verified ?? false;
    const cooldownActive = walletInfo?.cooldown_active ?? false;

    const parsedAmount = parseFloat(amount);
    const amountExceedsBalance = !isNaN(parsedAmount) && parsedAmount > winningBalance;

    const isDisabled =
        loading ||
        walletLoading ||
        !kycVerified ||
        cooldownActive ||
        amountExceedsBalance;

    const validate = (): number | null => {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) {
            setAmountError('Please enter a valid amount.');
            return null;
        }
        if (parsed < 100) {
            setAmountError('Minimum withdrawal is ₹100.');
            return null;
        }
        if (parsed > winningBalance) {
            setAmountError('Amount exceeds withdrawable balance.');
            return null;
        }
        setAmountError('');
        return parsed;
    };

    const onWithdraw = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = validate();
        if (parsed === null) return;
        try {
            setLoading(true);
            setServerError('');
            setSuccess('');
            await api.post('/wallet/withdraw', { amount: parsed });
            setSuccess('Withdrawal request submitted. It will be processed soon.');
            setAmount('');
            refetchWithdrawals();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            setServerError(err.response?.data?.message || 'Withdrawal request failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Withdraw Funds</h1>
                    <p className="text-sm text-gray-500 mt-1">Withdraw from your winning balance</p>
                </div>

                {walletLoading ? (
                    <div className="bg-white rounded-2xl p-6 flex justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                    </div>
                ) : walletInfo ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Withdrawable Balance</span>
                            <span className="text-lg font-bold text-green-700">₹{winningBalance.toFixed(2)}</span>
                        </div>
                        <p className="text-xs text-gray-400">
                            Only winning balance is withdrawable. Deposit balance can only be used for entry fees.
                        </p>
                        <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${kycVerified ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            {kycVerified ? (
                                <><ShieldCheck className="w-4 h-4" /> KYC Verified</>
                            ) : (
                                <><AlertCircle className="w-4 h-4" /> KYC Not Verified — Complete KYC to withdraw</>
                            )}
                        </div>
                        {cooldownActive && (
                            <div className="flex items-center gap-2 text-sm bg-amber-50 text-amber-700 px-3 py-2 rounded-lg">
                                <AlertCircle className="w-4 h-4" />
                                A cooldown period is active. Please wait before requesting a new withdrawal.
                            </div>
                        )}
                    </div>
                ) : null}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    {serverError && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{serverError}</div>
                    )}
                    {success && (
                        <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100">{success}</div>
                    )}
                    <form onSubmit={onWithdraw} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => { setAmount(e.target.value); setAmountError(''); }}
                                disabled={isDisabled || !kycVerified}
                                min={100}
                                max={winningBalance}
                                className={`w-full px-4 py-2 rounded-xl border ${amountError ? 'border-red-300' : 'border-gray-200'
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400`}
                                placeholder="Minimum ₹100"
                            />
                            {amountError && <p className="text-red-500 text-xs mt-1">{amountError}</p>}
                            {amountExceedsBalance && !amountError && (
                                <p className="text-red-500 text-xs mt-1">Amount exceeds withdrawable balance.</p>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={isDisabled}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Request Withdrawal'}
                        </button>
                    </form>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Recent Withdrawals</h2>
                    {wxLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                    ) : !withdrawals || withdrawals.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-4">No withdrawals yet.</p>
                    ) : (
                        <div className="divide-y divide-gray-50 -mx-2">
                            {withdrawals.map((tx) => (
                                <div key={tx.id} className="flex items-center justify-between px-2 py-3">
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">₹{tx.amount.toFixed(2)}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {new Date(tx.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(tx.status)}`}>
                                        {tx.status}
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
