'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
    Loader2,
    ArrowUpCircle,
    ArrowDownCircle,
    History,
    Plus,
    Wallet,
    Trophy,
    User,
    Home,
    Gift,
    Clock,
    ChevronRight,
    TrendingUp,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────
interface DashboardData {
    user: {
        id: string;
        mobile: string | null;
        email: string | null;
        role: string;
        accountStatus: string;
        kycStatus: string;
    };
    wallet: {
        depositBalance: number;
        winningBalance: number;
        bonusBalance: number;
        totalBalance: number;
    };
    recentTransactions: {
        id: string;
        type: string;
        debitAmount: number;
        creditAmount: number;
        status: string;
        description: string | null;
        createdAt: string;
    }[];
    activeTournaments: {
        id: string;
        title: string;
        gameType: string;
        entryFee: number;
        prizePool: number;
        maxParticipants: number;
        slotsFilled: number;
        status: string;
        scheduledAt: string;
        isJoined: boolean;
    }[];
}

async function fetchDashboard(): Promise<DashboardData> {
    const res = await api.get('/dashboard');
    return res.data?.data;
}

// ── Helpers ────────────────────────────────────────────
function formatCurrency(n: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(n);
}

function shortCurrency(n: number) {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n}`;
}

function relativeTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

function txIcon(type: string) {
    const credit = ['deposit', 'prize', 'refund'];
    if (credit.includes(type)) return <ArrowDownCircle className="w-5 h-5 text-emerald-400" />;
    return <ArrowUpCircle className="w-5 h-5 text-red-400" />;
}

function txColor(type: string) {
    const credit = ['deposit', 'prize', 'refund'];
    return credit.includes(type) ? 'text-emerald-400' : 'text-red-400';
}

function txSign(type: string) {
    const credit = ['deposit', 'prize', 'refund'];
    return credit.includes(type) ? '+' : '-';
}

function txAmount(tx: DashboardData['recentTransactions'][0]) {
    const credit = ['deposit', 'prize', 'refund'];
    return credit.includes(tx.type) ? tx.creditAmount : tx.debitAmount;
}

// ── Page ───────────────────────────────────────────────
export default function DashboardPage() {
    const { data, isLoading, error } = useQuery<DashboardData>({
        queryKey: ['dashboard'],
        queryFn: fetchDashboard,
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent-purpleText" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center p-6">
                <div className="text-center space-y-3">
                    <p className="text-red-400 font-medium">Failed to load dashboard</p>
                    <p className="text-text-secondary text-sm">Please try refreshing the page</p>
                </div>
            </div>
        );
    }

    const { wallet, recentTransactions, activeTournaments } = data;

    return (
        <div className="min-h-screen bg-app-bg text-text-primary pb-28">
            {/* Header */}
            <div className="px-5 pt-6 pb-2 flex items-center justify-between">
                <div>
                    <p className="text-text-secondary text-sm font-medium">Welcome back 👋</p>
                    <h1 className="text-xl font-bold mt-0.5">Dashboard</h1>
                </div>
                <Link href="/profile" className="w-10 h-10 rounded-full bg-app-card border border-app-cardBorder flex items-center justify-center">
                    <User className="w-5 h-5 text-text-secondary" />
                </Link>
            </div>

            <div className="px-5 space-y-5 mt-2">
                {/* ── Total Balance Hero ──────────────────── */}
                <div className="bg-gradient-to-br from-[#1E1545] via-[#1A1040] to-[#150D30] rounded-3xl p-6 border border-app-highlightBorder relative overflow-hidden">
                    {/* Decorative circles */}
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-accent-purpleText/5 blur-2xl" />
                    <div className="absolute -left-4 -bottom-6 w-24 h-24 rounded-full bg-accent-cyanText/5 blur-2xl" />

                    <p className="text-text-secondary text-sm font-medium mb-1">Total Balance</p>
                    <p className="text-4xl font-bold tracking-tight">{formatCurrency(wallet.totalBalance)}</p>

                    <div className="flex items-center gap-1.5 mt-2">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 text-xs font-semibold">Active</span>
                    </div>
                </div>

                {/* ── Wallet Breakdown ────────────────────── */}
                <div className="grid grid-cols-3 gap-3">
                    {/* Deposit Wallet */}
                    <div className="bg-app-card rounded-2xl border border-app-cardBorder p-4 space-y-2">
                        <div className="w-8 h-8 rounded-xl bg-accent-goldBg flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-accent-goldText" />
                        </div>
                        <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wider">Deposit</p>
                        <p className="text-base font-bold">{shortCurrency(wallet.depositBalance)}</p>
                    </div>

                    {/* Winning Wallet */}
                    <div className="bg-app-card rounded-2xl border border-app-cardBorder p-4 space-y-2">
                        <div className="w-8 h-8 rounded-xl bg-accent-cyanBg flex items-center justify-center">
                            <Trophy className="w-4 h-4 text-accent-cyanText" />
                        </div>
                        <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wider">Winning</p>
                        <p className="text-base font-bold">{shortCurrency(wallet.winningBalance)}</p>
                    </div>

                    {/* Bonus Wallet */}
                    <div className="bg-app-card rounded-2xl border border-app-cardBorder p-4 space-y-2">
                        <div className="w-8 h-8 rounded-xl bg-accent-purpleBg flex items-center justify-center">
                            <Gift className="w-4 h-4 text-accent-purpleText" />
                        </div>
                        <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wider">Bonus</p>
                        <p className="text-base font-bold">{shortCurrency(wallet.bonusBalance)}</p>
                    </div>
                </div>

                {/* ── Action Buttons ──────────────────────── */}
                <div className="grid grid-cols-3 gap-3">
                    <Link
                        href="/deposit"
                        className="flex flex-col items-center justify-center bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 rounded-2xl border border-emerald-500/20 p-4 gap-2 hover:border-emerald-500/40 transition-all active:scale-95"
                    >
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Plus className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-xs font-semibold text-emerald-400">Deposit</span>
                    </Link>
                    <Link
                        href="/withdraw"
                        className="flex flex-col items-center justify-center bg-gradient-to-b from-accent-purpleText/10 to-accent-purpleText/5 rounded-2xl border border-accent-purpleText/20 p-4 gap-2 hover:border-accent-purpleText/40 transition-all active:scale-95"
                    >
                        <div className="w-10 h-10 rounded-full bg-accent-purpleText/20 flex items-center justify-center">
                            <ArrowUpCircle className="w-5 h-5 text-accent-purpleText" />
                        </div>
                        <span className="text-xs font-semibold text-accent-purpleText">Withdraw</span>
                    </Link>
                    <Link
                        href="/wallet"
                        className="flex flex-col items-center justify-center bg-gradient-to-b from-accent-goldText/10 to-accent-goldText/5 rounded-2xl border border-accent-goldText/20 p-4 gap-2 hover:border-accent-goldText/40 transition-all active:scale-95"
                    >
                        <div className="w-10 h-10 rounded-full bg-accent-goldText/20 flex items-center justify-center">
                            <History className="w-5 h-5 text-accent-goldText" />
                        </div>
                        <span className="text-xs font-semibold text-accent-goldText">History</span>
                    </Link>
                </div>

                {/* ── Live Tournaments ────────────────────── */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold">Live Tournaments</h2>
                        <Link href="/tournaments" className="text-accent-cyanText text-xs font-semibold flex items-center gap-0.5 hover:underline">
                            View All <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {activeTournaments.length === 0 ? (
                        <div className="bg-app-card rounded-2xl border border-app-cardBorder p-8 text-center">
                            <Trophy className="w-8 h-8 text-text-secondary/40 mx-auto mb-3" />
                            <p className="text-text-secondary text-sm">No active tournaments right now</p>
                            <Link href="/tournaments" className="text-accent-cyanText text-xs font-semibold mt-2 inline-block hover:underline">
                                Browse upcoming →
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeTournaments.map((t) => {
                                const fillPercent = Math.round((t.slotsFilled / t.maxParticipants) * 100);
                                return (
                                    <Link key={t.id} href={`/tournaments/${t.id}`} className="block">
                                        <div className="bg-app-card rounded-2xl border border-app-cardBorder p-4 hover:border-accent-cyanText/30 transition-colors">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <p className="font-semibold text-sm">{t.title}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-cyanBg text-accent-cyanText font-medium uppercase tracking-wider">
                                                            {t.gameType}
                                                        </span>
                                                        {t.status === 'in_progress' && (
                                                            <span className="flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Live</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-accent-goldText font-bold text-sm">{shortCurrency(t.prizePool)}</p>
                                                    <p className="text-[10px] text-text-secondary">Prize Pool</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-xs text-text-secondary">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{new Date(t.scheduledAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <span>Entry: {shortCurrency(t.entryFee)}</span>
                                            </div>

                                            <div className="mt-3">
                                                <div className="flex justify-between text-[10px] text-text-secondary mb-1">
                                                    <span>{t.slotsFilled}/{t.maxParticipants} Joined</span>
                                                    <span>{fillPercent}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-accent-cyanText to-accent-purpleText transition-all"
                                                        style={{ width: `${fillPercent}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {t.isJoined && (
                                                <div className="mt-2 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                                                    ✓ Joined
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Recent Transactions ──────────────────── */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold">Recent Transactions</h2>
                        <Link href="/wallet" className="text-accent-goldText text-xs font-semibold flex items-center gap-0.5 hover:underline">
                            View All <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {recentTransactions.length === 0 ? (
                        <div className="bg-app-card rounded-2xl border border-app-cardBorder p-8 text-center">
                            <History className="w-8 h-8 text-text-secondary/40 mx-auto mb-3" />
                            <p className="text-text-secondary text-sm">No transactions yet</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentTransactions.map((tx) => (
                                <div key={tx.id} className="bg-app-card rounded-2xl border border-app-cardBorder px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                                            {txIcon(tx.type)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold capitalize">{tx.type.replace('_', ' ')}</p>
                                            <p className="text-[10px] text-text-secondary mt-0.5">{relativeTime(tx.createdAt)}</p>
                                        </div>
                                    </div>
                                    <p className={`font-bold text-sm ${txColor(tx.type)}`}>
                                        {txSign(tx.type)}{formatCurrency(txAmount(tx))}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Bottom Navigation ────────────────────── */}
            <div className="fixed bottom-0 left-0 right-0 bg-app-card/95 backdrop-blur-xl border-t border-app-cardBorder z-50">
                <div className="max-w-[480px] mx-auto px-6 h-[72px] flex items-center justify-between">
                    <Link href="/dashboard" className="flex flex-col items-center gap-1 min-w-[56px]">
                        <div className="w-9 h-9 rounded-xl bg-accent-purpleText/20 flex items-center justify-center">
                            <Home className="w-[18px] h-[18px] text-accent-purpleText" />
                        </div>
                        <span className="text-[10px] font-bold text-accent-purpleText tracking-wider">Home</span>
                    </Link>

                    <Link href="/tournaments" className="flex flex-col items-center gap-1 min-w-[56px]">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center">
                            <Trophy className="w-[18px] h-[18px] text-text-secondary" />
                        </div>
                        <span className="text-[10px] font-medium text-text-secondary tracking-wider">Tournaments</span>
                    </Link>

                    <Link href="/wallet" className="flex flex-col items-center gap-1 min-w-[56px]">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center">
                            <Wallet className="w-[18px] h-[18px] text-text-secondary" />
                        </div>
                        <span className="text-[10px] font-medium text-text-secondary tracking-wider">Wallet</span>
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
