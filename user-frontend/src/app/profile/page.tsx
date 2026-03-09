'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import {
    Loader2,
    LogOut,
    ShieldCheck,
    Wallet,
    Trophy,
    User,
    Home,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';

// Reusing same type structure as dashboard to keep it simple
interface ProfileData {
    user: {
        id: string;
        mobile: string | null;
        email: string | null;
        role: string;
        accountStatus: string;
        kycStatus: string;
    };
    wallet: {
        totalBalance: number;
    };
}

export default function ProfilePage() {
    const router = useRouter();

    const { data: profile, isLoading } = useQuery<ProfileData>({
        queryKey: ['profile'],
        queryFn: async () => {
            const res = await api.get('/dashboard'); // Reuse dashboard endpoint for user data
            return res.data?.data;
        },
    });

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
            router.push('/login');
        } catch {
            // Even if it fails (network error), forcefully push them to login
            router.push('/login');
        }
    };

    if (isLoading || !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-app-bg">
                <Loader2 className="w-8 h-8 animate-spin text-accent-purpleText" />
            </div>
        );
    }

    const { user, wallet } = profile;

    return (
        <div className="min-h-screen bg-app-bg text-white pb-[90px]">
            {/* ── Header ────────────────────────────────────────── */}
            <div className="sticky top-0 z-40 bg-app-bg/80 backdrop-blur-xl border-b border-app-cardBorder">
                <div className="max-w-[480px] mx-auto px-6 h-16 flex items-center justify-between">
                    <h1 className="text-lg font-bold">My Profile</h1>
                </div>
            </div>

            <div className="max-w-[480px] mx-auto px-4 mt-6 space-y-6">
                {/* ── User Card ─────────────────────────────────────── */}
                <div className="bg-app-card rounded-2xl border border-app-cardBorder p-6 relative overflow-hidden">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-16 h-16 rounded-full bg-accent-purpleText/20 flex items-center justify-center border-2 border-accent-purpleText/50">
                            <User className="w-8 h-8 text-accent-purpleText" />
                        </div>
                        <div>
                            <p className="text-lg font-bold">Player Account</p>
                            <p className="text-sm text-text-secondary mt-1">{user.email || user.mobile || 'No Contact Provided'}</p>
                        </div>
                    </div>
                </div>

                {/* ── Quick Stats ───────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-app-card rounded-2xl border border-app-cardBorder p-4 flex flex-col items-center justify-center text-center">
                        <Wallet className="w-6 h-6 text-accent-cyanText mb-2" />
                        <p className="text-xs text-text-secondary">Total Balance</p>
                        <p className="font-bold text-lg mt-1">₹{wallet.totalBalance.toLocaleString()}</p>
                    </div>

                    <Link href="/kyc" className="bg-app-card rounded-2xl border border-app-cardBorder p-4 flex flex-col items-center justify-center text-center transition-colors active:scale-95">
                        {user.kycStatus === 'verified' ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-400 mb-2" />
                        ) : user.kycStatus === 'pending' || user.kycStatus === 'rejected' ? (
                            <AlertCircle className="w-6 h-6 text-red-400 mb-2" />
                        ) : (
                            <ShieldCheck className="w-6 h-6 text-accent-goldText mb-2" />
                        )}
                        <p className="text-xs text-text-secondary">KYC Status</p>
                        <p className={`font-bold text-sm mt-1 capitalize ${user.kycStatus === 'verified' ? 'text-emerald-400'
                                : user.kycStatus === 'pending' || user.kycStatus === 'rejected' ? 'text-red-400'
                                    : 'text-accent-goldText'
                            }`}>
                            {user.kycStatus}
                        </p>
                    </Link>
                </div>

                {/* ── Actions ───────────────────────────────────────── */}
                <div className="bg-app-card rounded-2xl border border-app-cardBorder overflow-hidden mt-6">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                                <LogOut className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-red-400">Logout</p>
                                <p className="text-xs text-text-secondary mt-0.5">Securely sign out of your account</p>
                            </div>
                        </div>
                    </button>
                </div>
            </div>

            {/* ── Bottom Navigation ────────────────────── */}
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
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center">
                            <Wallet className="w-[18px] h-[18px] text-text-secondary" />
                        </div>
                        <span className="text-[10px] font-medium text-text-secondary tracking-wider">Wallet</span>
                    </Link>

                    <Link href="/profile" className="flex flex-col items-center gap-1 min-w-[56px]">
                        <div className="w-9 h-9 rounded-xl bg-accent-purpleText/20 flex items-center justify-center">
                            <User className="w-[18px] h-[18px] text-accent-purpleText" />
                        </div>
                        <span className="text-[10px] font-bold text-accent-purpleText tracking-wider">Profile</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
