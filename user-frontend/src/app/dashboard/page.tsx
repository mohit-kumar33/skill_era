'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { WalletBalance, Transaction } from '@/lib/types';
import { Loader2, ArrowUpCircle, ArrowDownCircle, History, Plus, Users, Wallet, Trophy, ArrowDownLeft, Upload } from 'lucide-react';

async function fetchWallet(): Promise<WalletBalance> {
    const res = await api.get('/wallet/balance');
    const d = res.data?.data || {};
    return {
        deposit_balance: parseFloat(d.depositBalance || '0'),
        winning_balance: parseFloat(d.winningBalance || '0'),
        total_balance: parseFloat(d.totalBalance || '0'),
    };
}

async function fetchTransactions(): Promise<Transaction[]> {
    const res = await api.get('/wallet/transactions?limit=10');
    const txs = res.data?.data?.transactions || [];
    return txs.map((t: Record<string, any>) => ({
        id: t.id,
        type: (t.transactionType || '').toLowerCase(),
        amount: parseFloat(t.transactionType === 'DEPOSIT' || t.transactionType === 'PRIZE' || t.transactionType === 'REFUND' ? (t.creditAmount || '0') : (t.debitAmount || '0')),
        status: t.status,
        created_at: t.createdAt,
    }));
}

// Helper functions removed

export default function DashboardPage() {
    const {
        data: wallet,
        isLoading: walletLoading,
        error: walletError,
    } = useQuery({ queryKey: ['wallet'], queryFn: fetchWallet });

    const { data: transactions, isLoading: txLoading } = useQuery({
        queryKey: ['transactions'],
        queryFn: fetchTransactions,
    });

    return (
        <div className="min-h-screen bg-app-bg text-text-primary p-4 md:p-8 pb-32">
            <div className="max-w-[480px] mx-auto space-y-6">
                {/* Highlight Card */}
                <div className="bg-gradient-to-b from-app-highlightCardFrom to-app-highlightCardTo rounded-3xl border border-app-highlightBorder p-6 relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                        <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-2">
                            <Users className="w-4 h-4 text-text-secondary" />
                            <span className="text-sm font-medium text-text-secondary">SLR Family Pool</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-accent-cyanText animate-pulse"></span>
                            <span className="text-xs font-bold text-accent-cyanText tracking-widest uppercase">Live</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <p className="text-text-secondary text-sm font-medium">Total Savings</p>
                        {walletLoading ? (
                            <Loader2 className="w-8 h-8 animate-spin text-accent-purpleText my-2" />
                        ) : walletError ? (
                            <p className="text-red-400">Error</p>
                        ) : wallet ? (
                            <div className="flex items-baseline gap-1">
                                <span className="text-5xl font-bold tracking-tight">₹</span>
                                <span className="text-6xl font-bold tracking-tighter">{wallet.total_balance.toFixed(0)}</span>
                            </div>
                        ) : null}
                    </div>

                    <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <ArrowUpCircle className="w-4 h-4 text-accent-cyanText" />
                            <span className="text-sm text-text-secondary">Growing strong!</span>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs text-text-secondary font-medium">
                            {/* Dummy user count for now */}
                            5 Members
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-3 gap-3">
                    <Link
                        href="/wallet"
                        className="flex flex-col items-center justify-center bg-accent-goldBg rounded-2xl border border-white/5 shadow-sm p-5 hover:border-accent-goldText/50 transition-colors gap-3"
                    >
                        <div className="w-8 h-8 rounded-full border border-accent-goldText flex items-center justify-center">
                            <Plus className="w-4 h-4 text-accent-goldText" />
                        </div>
                        <span className="text-sm font-medium text-accent-goldText">Contribute</span>
                    </Link>
                    <Link
                        href="/withdraw"
                        className="flex flex-col items-center justify-center bg-accent-purpleBg rounded-2xl border border-white/5 shadow-sm p-5 hover:border-accent-purpleText/50 transition-colors gap-3"
                    >
                        <div className="w-8 h-8 rounded-full bg-accent-purpleText/20 flex items-center justify-center">
                            <Upload className="w-4 h-4 text-accent-purpleText" />
                        </div>
                        <span className="text-sm font-medium text-accent-purpleText">Withdraw</span>
                    </Link>
                    <Link
                        href="/tournaments"
                        className="flex flex-col items-center justify-center bg-accent-cyanBg rounded-2xl border border-white/5 shadow-sm p-5 hover:border-accent-cyanText/50 transition-colors gap-3"
                    >
                        <div className="w-8 h-8 rounded-full border border-accent-cyanText flex items-center justify-center">
                            <History className="w-4 h-4 text-accent-cyanText" />
                        </div>
                        <span className="text-sm font-medium text-accent-cyanText">History</span>
                    </Link>
                </div>

                {/* Micro Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-app-card rounded-2xl border border-app-cardBorder p-4 flex items-center gap-4">
                        <div className="bg-white/5 p-2 rounded-xl">
                            <Wallet className="w-5 h-5 text-text-secondary" />
                        </div>
                        <div>
                            <p className="text-xs text-text-secondary font-medium">My Savings</p>
                            <p className="text-xl font-bold text-text-primary">
                                ₹{wallet?.winning_balance ? wallet.winning_balance.toFixed(0) : '0'}
                            </p>
                        </div>
                    </div>
                    <div className="bg-app-card rounded-2xl border border-app-cardBorder p-4 flex items-center gap-4">
                        <div className="bg-accent-purpleText/10 p-2 rounded-xl">
                            <ArrowDownCircle className="w-5 h-5 text-accent-purpleText" />
                        </div>
                        <div>
                            <p className="text-xs text-text-secondary font-medium">Deposits</p>
                            <p className="text-xl font-bold text-text-primary">
                                {wallet?.deposit_balance ? wallet.deposit_balance.toFixed(0) : '0'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Transaction History */}
                <div className="pt-2">
                    <h2 className="text-lg font-semibold text-text-primary mb-4">
                        Recent Activity
                    </h2>
                    {txLoading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
                        </div>
                    ) : !transactions || transactions.length === 0 ? (
                        <p className="text-text-secondary text-sm text-center py-4">No transactions yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {transactions.map((tx) => (
                                <div key={tx.id} className="bg-app-card rounded-2xl border border-app-cardBorder p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-accent-cyanText/10 p-2 rounded-full">
                                            <ArrowDownCircle className="w-5 h-5 text-accent-cyanText" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-text-primary capitalize">{tx.type.replace('_', ' ')}</p>
                                            <p className="text-xs text-text-secondary mt-0.5">
                                                {new Date(tx.created_at).toLocaleString('en-IN', {
                                                    month: 'numeric',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-accent-cyanText">+₹{tx.amount.toFixed(0)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bottom Navigation */}
                <div className="fixed bottom-0 left-0 right-0 bg-app-card/90 backdrop-blur-md border-t border-app-cardBorder sm:hidden z-50">
                    <div className="max-w-[480px] mx-auto px-6 h-20 flex items-center justify-between relative">
                        <Link href="/dashboard" className="flex flex-col items-center gap-1 group">
                            <div className="bg-accent-goldBg px-4 py-1.5 rounded-full transition-colors">
                                <ArrowUpCircle className="w-5 h-5 text-accent-goldText" />
                            </div>
                            <span className="text-[10px] font-bold text-accent-goldText tracking-wider">Home</span>
                        </Link>

                        <Link href="/family" className="flex flex-col items-center gap-1">
                            <Users className="w-5 h-5 text-text-secondary" />
                            <span className="text-[10px] font-medium text-text-secondary tracking-wider">Members</span>
                        </Link>

                        {/* Floating Action Button */}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-6">
                            <button className="w-16 h-16 bg-accent-goldText rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(232,197,135,0.3)] hover:scale-105 active:scale-95 transition-all">
                                <Plus className="w-8 h-8 text-black" />
                            </button>
                        </div>

                        <Link href="/tournaments" className="flex flex-col items-center gap-1">
                            <History className="w-5 h-5 text-text-secondary" />
                            <span className="text-[10px] font-medium text-text-secondary tracking-wider">History</span>
                        </Link>

                        <Link href="/profile" className="flex flex-col items-center gap-1">
                            <div className="w-5 h-5 rounded-full bg-text-secondary/20 flex items-center justify-center">
                                <Users className="w-3 h-3 text-text-secondary" />
                            </div>
                            <span className="text-[10px] font-medium text-text-secondary tracking-wider">Profile</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
