'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, DashboardStats, TreasurySnapshot } from '@/lib/types';
import { PageLoader } from '@/components/LoadingSpinner';
import ErrorAlert from '@/components/ErrorAlert';
import {
    Users,
    Trophy,
    Wallet,
    IndianRupee,
    TrendingUp,
    ShieldAlert,
    Banknote,
    BarChart3,
} from 'lucide-react';

export default function DashboardPage() {
    const stats = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            const res = await api.get<ApiResponse<DashboardStats>>('/admin/stats');
            return res.data.data;
        },
    });

    const treasury = useQuery({
        queryKey: ['treasury'],
        queryFn: async () => {
            const res = await api.get<ApiResponse<TreasurySnapshot>>('/admin/treasury');
            return res.data.data;
        },
    });

    if (stats.isLoading) return <PageLoader />;
    if (stats.error) return <ErrorAlert error={stats.error as Error} />;

    const s = stats.data;

    const cards = [
        {
            label: 'Total Users',
            value: s?.totalUsers?.toLocaleString() ?? '—',
            icon: Users,
            gradient: 'from-accent-purpleBg to-app-highlightCardTo',
            shadow: 'shadow-app-highlightCardTo/20',
            iconColor: 'text-accent-purpleText',
            bgIcon: 'bg-accent-purpleText/20',
        },
        {
            label: 'Active Tournaments',
            value: s?.activeTournaments?.toLocaleString() ?? '—',
            icon: Trophy,
            gradient: 'from-accent-cyanBg to-app-bg',
            shadow: 'shadow-accent-cyanBg/20',
            iconColor: 'text-accent-cyanText',
            bgIcon: 'bg-accent-cyanText/20',
        },
        {
            label: 'Pending Withdrawals',
            value: s?.pendingWithdrawals?.toLocaleString() ?? '—',
            icon: Wallet,
            gradient: 'from-accent-goldBg to-app-bg',
            shadow: 'shadow-accent-goldBg/20',
            iconColor: 'text-accent-goldText',
            bgIcon: 'bg-accent-goldText/20',
        },
        {
            label: 'Revenue Today',
            value: `₹${Number(s?.revenueToday ?? 0).toLocaleString()}`,
            icon: IndianRupee,
            gradient: 'from-accent-cyanBg to-app-bg',
            shadow: 'shadow-accent-cyanBg/20',
            iconColor: 'text-accent-cyanText',
            bgIcon: 'bg-accent-cyanText/20',
        },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => (
                    <div
                        key={card.label}
                        className={`relative overflow-hidden rounded-2xl border border-app-cardBorder bg-app-card p-5 shadow-lg ${card.shadow}`}
                    >
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <p className="text-sm font-medium text-text-secondary">{card.label}</p>
                                <p className="mt-2 text-3xl font-bold text-text-primary">{card.value}</p>
                            </div>
                            <div className={`rounded-full ${card.bgIcon} p-3`}>
                                <card.icon className={`h-6 w-6 ${card.iconColor}`} />
                            </div>
                        </div>
                        {/* Decorative gradient */}
                        <div className={`absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-gradient-to-br ${card.gradient} opacity-20 blur-3xl z-0`} />
                    </div>
                ))}
            </div>

            {/* Treasury Snapshot */}
            {treasury.data && (
                <div className="rounded-2xl border border-app-cardBorder bg-app-card p-6 relative overflow-hidden">
                    <div className="mb-4 flex items-center gap-2 relative z-10">
                        <div className="bg-accent-purpleText/20 p-2 rounded-xl">
                            <BarChart3 className="h-5 w-5 text-accent-purpleText" />
                        </div>
                        <h2 className="text-lg font-semibold text-text-primary">Treasury Snapshot</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <TreasuryCard
                            label="Total User Balance"
                            value={treasury.data.totalUserBalance}
                            icon={<Banknote className="h-4 w-4" />}
                        />
                        <TreasuryCard
                            label="Pending Withdrawals"
                            value={treasury.data.pendingWithdrawals}
                            icon={<ShieldAlert className="h-4 w-4" />}
                        />
                        <TreasuryCard
                            label="Liquidity Ratio"
                            value={`${Number(treasury.data.liquidityRatio).toFixed(2)}x`}
                            icon={<TrendingUp className="h-4 w-4" />}
                            highlight={Number(treasury.data.liquidityRatio) < 1.3}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function TreasuryCard({
    label,
    value,
    icon,
    highlight = false,
}: {
    label: string;
    value: string;
    icon: React.ReactNode;
    highlight?: boolean;
}) {
    return (
        <div className={`rounded-2xl border relative z-10 px-5 py-4 ${highlight
            ? 'border-red-500/30 bg-red-950/20'
            : 'border-white/5 bg-white/5'
            }`}>
            <div className="flex items-center gap-2">
                <span className={highlight ? 'text-red-400' : 'text-text-secondary'}>{icon}</span>
                <span className="text-sm font-medium text-text-secondary">{label}</span>
            </div>
            <p className={`mt-2 text-2xl font-bold tracking-tight ${highlight ? 'text-red-400' : 'text-text-primary'}`}>
                {value.startsWith('₹') ? value : `₹${Number(value).toLocaleString()}`}
            </p>
        </div>
    );
}
