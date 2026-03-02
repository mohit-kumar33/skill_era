'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    Trophy,
    Wallet,
    ShieldCheck,
    ScrollText,
    LogOut,
} from 'lucide-react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/users', label: 'Users', icon: Users },
    { href: '/tournaments', label: 'Tournaments', icon: Trophy },
    { href: '/withdrawals', label: 'Withdrawals', icon: Wallet },
    { href: '/kyc', label: 'KYC', icon: ShieldCheck },
    { href: '/audit-log', label: 'Audit Log', icon: ScrollText },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            // Clear cookies even if request fails
        }
        router.push('/login');
    };

    return (
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-950">
            {/* Logo */}
            <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                    <Trophy className="h-4 w-4 text-white" />
                </div>
                <span className="text-lg font-bold text-white">Apex Admin</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${isActive
                                    ? 'bg-indigo-600/20 text-indigo-400'
                                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                                }`}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Logout */}
            <div className="border-t border-zinc-800 px-3 py-4">
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition-all hover:bg-red-500/10"
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </button>
            </div>
        </aside>
    );
}
