'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { Transaction } from '@/lib/types';
import {
    Loader2,
    RefreshCw,
    Plus,
    ArrowUpCircle,
    ArrowDownCircle,
    History,
    Wallet,
    Trophy,
    Gift,
    ChevronRight,
    Home,
    User,
    Clock,
} from 'lucide-react';

// ── Data fetchers ──────────────────────────────────────
interface WalletData {
    depositBalance: number;
    winningBalance: number;
    bonusBalance: number;
    totalBalance: number;
}

interface TxItem {
    id: string;
    transactionType: string;
    debitAmount: string;
    creditAmount: string;
    status: string;
    description: string | null;
    createdAt: string;
}

async function fetchWallet(): Promise<WalletData> {
    const res = await api.get('/wallet/balance');
    const d = res.data?.data || {};
    return {
        depositBalance: parseFloat(d.depositBalance || '0'),
        winningBalance: parseFloat(d.winningBalance || '0'),
        bonusBalance: parseFloat(d.bonusBalance || '0'),
        totalBalance: parseFloat(d.totalBalance || '0'),
    };
}

async function fetchTransactions(): Promise<TxItem[]> {
    const res = await api.get('/wallet/transactions?limit=20');
    return res.data?.data?.transactions || [];
}

// ── Helpers ────────────────────────────────────────────
function formatCurrency(n: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(n);
}

function relativeTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const CREDIT_TYPES = ['deposit', 'prize', 'refund'];

function isCreditTx(type: string) {
    return CREDIT_TYPES.includes(type.toLowerCase());
}

// ── Page ───────────────────────────────────────────────
export default function WalletPage() {
    const queryClient = useQueryClient();

    // Deposit form state
    const [amount, setAmount] = useState('');
    const [amountError, setAmountError] = useState('');
    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState('');
    const [success, setSuccess] = useState('');
    const [pollTimedOut, setPollTimedOut] = useState(false);

    // Active tab for transaction filter
    const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals'>('all');

    // Queries
    const { data: wallet, isLoading: walletLoading } = useQuery({
        queryKey: ['walletBalance'],
        queryFn: fetchWallet,
    });

    const { data: transactions, isLoading: txLoading, refetch: refetchTx } = useQuery({
        queryKey: ['walletTransactions'],
        queryFn: fetchTransactions,
    });

    // Polling for pending deposits
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
            await refetchTx();
            queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
        }, 5000);
        pollTimeoutRef.current = setTimeout(() => {
            stopPolling();
            setPollTimedOut(true);
        }, 30000);
    }, [refetchTx, stopPolling, queryClient]);

    useEffect(() => {
        return () => stopPolling();
    }, [stopPolling]);

    // Deposit handler
    const onDeposit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) { setAmountError('Enter a valid amount'); return; }
        if (parsed < 100) { setAmountError('Minimum ₹100'); return; }
        setAmountError('');

        try {
            setLoading(true);
            setServerError('');
            setSuccess('');
            await api.post('/wallet/deposit', { amount: parsed });
            setAmount('');
            setSuccess('Deposit initiated! Processing...');
            startPolling();
            await refetchTx();
            queryClient.invalidateQueries({ queryKey: ['walletBalance'] });
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            setServerError(err.response?.data?.message || 'Deposit failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Filter transactions
    const filteredTx = (transactions || []).filter((tx) => {
        if (activeTab === 'deposits') return isCreditTx(tx.transactionType);
        if (activeTab === 'withdrawals') return !isCreditTx(tx.transactionType);
        return true;
    });

    return (
        <div className="min-h-screen bg-app-bg text-text-primary pb-28">
            {/* Header */}
            <div className="px-5 pt-6 pb-2 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">My Wallet</h1>
                    <p className="text-text-secondary text-sm mt-0.5">Manage your funds</p>
                </div>
                <button
                    onClick={() => { refetchTx(); queryClient.invalidateQueries({ queryKey: ['walletBalance'] }); }}
                    className="w-10 h-10 rounded-full bg-app-card border border-app-cardBorder flex items-center justify-center hover:border-accent-purpleText/40 transition-colors"
                >
                    <RefreshCw className="w-4 h-4 text-text-secondary" />
                </button>
            </div>

            <div className="px-5 space-y-5 mt-2">
                {/* ── Total Balance Hero ──────────────── */}
                {walletLoading ? (
                    <div className="bg-app-card rounded-3xl border border-app-cardBorder p-8 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-accent-purpleText" />
                    </div>
                ) : wallet ? (
                    <div className="bg-gradient-to-br from-[#1E1545] via-[#1A1040] to-[#150D30] rounded-3xl p-6 border border-app-highlightBorder relative overflow-hidden">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-accent-purpleText/5 blur-2xl" />
                        <p className="text-text-secondary text-sm font-medium mb-1">Total Balance</p>
                        <p className="text-4xl font-bold tracking-tight">{formatCurrency(wallet.totalBalance)}</p>
                    </div>
                ) : null}

                {/* ── Wallet Breakdown ────────────────── */}
                {wallet && (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-app-card rounded-2xl border border-app-cardBorder p-4 space-y-2">
                            <div className="w-8 h-8 rounded-xl bg-accent-goldBg flex items-center justify-center">
                                <Wallet className="w-4 h-4 text-accent-goldText" />
                            </div>
                            <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wider">Deposit</p>
                            <p className="text-base font-bold">{formatCurrency(wallet.depositBalance)}</p>
                        </div>
                        <div className="bg-app-card rounded-2xl border border-app-cardBorder p-4 space-y-2">
                            <div className="w-8 h-8 rounded-xl bg-accent-cyanBg flex items-center justify-center">
                                <Trophy className="w-4 h-4 text-accent-cyanText" />
                            </div>
                            <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wider">Winning</p>
                            <p className="text-base font-bold">{formatCurrency(wallet.winningBalance)}</p>
                        </div>
                        <div className="bg-app-card rounded-2xl border border-app-cardBorder p-4 space-y-2">
                            <div className="w-8 h-8 rounded-xl bg-accent-purpleBg flex items-center justify-center">
                                <Gift className="w-4 h-4 text-accent-purpleText" />
                            </div>
                            <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wider">Bonus</p>
                            <p className="text-base font-bold">{formatCurrency(wallet.bonusBalance)}</p>
                        </div>
                    </div>
                )}

                {/* ── Action Buttons ──────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                    <Link
                        href="/withdraw"
                        className="flex items-center justify-center gap-2 bg-gradient-to-b from-accent-purpleText/10 to-accent-purpleText/5 rounded-2xl border border-accent-purpleText/20 p-4 hover:border-accent-purpleText/40 transition-all active:scale-95"
                    >
                        <ArrowUpCircle className="w-5 h-5 text-accent-purpleText" />
                        <span className="text-sm font-semibold text-accent-purpleText">Withdraw</span>
                    </Link>
                    <Link
                        href="/dashboard"
                        className="flex items-center justify-center gap-2 bg-gradient-to-b from-accent-goldText/10 to-accent-goldText/5 rounded-2xl border border-accent-goldText/20 p-4 hover:border-accent-goldText/40 transition-all active:scale-95"
                    >
                        <History className="w-5 h-5 text-accent-goldText" />
                        <span className="text-sm font-semibold text-accent-goldText">Dashboard</span>
                    </Link>
                </div>

                {/* ── Quick Deposit Link ──────────────── */}
                <Link href="/deposit" className="block bg-app-card rounded-2xl border border-app-cardBorder p-5 hover:border-emerald-500/40 transition-all group">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                                <Plus className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-text-primary">Add Funds</h2>
                                <p className="text-xs text-text-secondary mt-0.5">UPI, Cards, Net Banking</p>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-app-bg border border-app-cardBorder flex items-center justify-center text-text-secondary group-hover:text-emerald-400 group-hover:border-emerald-400/30 transition-colors">
                            →
                        </div>
                    </div>
                </Link>

                {/* ── Transaction History ─────────────── */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold">Transaction History</h2>
                        <button onClick={() => refetchTx()} className="text-text-secondary hover:text-text-primary transition-colors">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Filter tabs */}
                    <div className="flex gap-2 mb-3">
                        {(['all', 'deposits', 'withdrawals'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all capitalize ${activeTab === tab
                                    ? 'bg-accent-purpleText/20 text-accent-purpleText border border-accent-purpleText/30'
                                    : 'bg-white/5 text-text-secondary border border-white/10 hover:border-white/20'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {txLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
                        </div>
                    ) : filteredTx.length === 0 ? (
                        <div className="bg-app-card rounded-2xl border border-app-cardBorder p-8 text-center">
                            <History className="w-8 h-8 text-text-secondary/40 mx-auto mb-3" />
                            <p className="text-text-secondary text-sm">No transactions found</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredTx.map((tx) => {
                                const isCredit = isCreditTx(tx.transactionType);
                                const txAmount = parseFloat(isCredit ? tx.creditAmount : tx.debitAmount);
                                return (
                                    <div key={tx.id} className="bg-app-card rounded-2xl border border-app-cardBorder px-4 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isCredit ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                                {isCredit
                                                    ? <ArrowDownCircle className="w-5 h-5 text-emerald-400" />
                                                    : <ArrowUpCircle className="w-5 h-5 text-red-400" />
                                                }
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold capitalize">
                                                    {tx.transactionType.replace('_', ' ').toLowerCase()}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] text-text-secondary flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {relativeTime(tx.createdAt)}
                                                    </span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tx.status === 'confirmed'
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : tx.status === 'failed'
                                                            ? 'bg-red-500/10 text-red-400'
                                                            : 'bg-amber-500/10 text-amber-400'
                                                        }`}>
                                                        {tx.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className={`font-bold text-sm ${isCredit ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {isCredit ? '+' : '-'}{formatCurrency(txAmount)}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Bottom Navigation ────────────────── */}
            <div className="fixed bottom-0 left-0 right-0 bg-app-card/95 backdrop-blur-xl border-t border-app-cardBorder z-50">
                <div className="max-w-[480px] mx-auto px-6 h-[72px] flex items-center justify-between">
                    <Link href="/dashboard" className="flex flex-col items-center gap-1 min-w-[56px]">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center">
                            <Home className="w-[18px] h-[18px] text-text-secondary" />
                        </div>
                        <span className="text-[10px] font-medium text-text-secondary tracking-wider">Home</span>
                    </Link>
                    <Link href="/tournaments" className="flex flex-col items-center gap-1 min-w-[56px]">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center">
                            <Trophy className="w-[18px] h-[18px] text-text-secondary" />
                        </div>
                        <span className="text-[10px] font-medium text-text-secondary tracking-wider">Tournaments</span>
                    </Link>
                    <Link href="/wallet" className="flex flex-col items-center gap-1 min-w-[56px]">
                        <div className="w-9 h-9 rounded-xl bg-accent-purpleText/20 flex items-center justify-center">
                            <Wallet className="w-[18px] h-[18px] text-accent-purpleText" />
                        </div>
                        <span className="text-[10px] font-bold text-accent-purpleText tracking-wider">Wallet</span>
                    </Link>
                    <Link href="/profile" className="flex flex-col items-center gap-1 min-w-[56px]">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center">
                            <User className="w-[18px] h-[18px] text-text-secondary" />
                        </div>
                        <span className="text-[10px] font-medium text-text-secondary tracking-wider">Profile</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
