'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, AdminUser } from '@/lib/types';
import { User } from 'lucide-react';

export default function Topbar() {
    const { data } = useQuery({
        queryKey: ['admin-me'],
        queryFn: async () => {
            const res = await api.get<ApiResponse<AdminUser>>('/users/me');
            return res.data.data;
        },
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-6 backdrop-blur-sm">
            <div />
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl bg-zinc-800/50 px-3 py-1.5">
                    <User className="h-4 w-4 text-zinc-400" />
                    <span className="text-sm text-zinc-300">
                        {data?.mobile ?? '...'}
                    </span>
                    <span className="rounded-md bg-indigo-600/30 px-2 py-0.5 text-xs font-medium text-indigo-400">
                        {data?.role?.replace('_', ' ') ?? ''}
                    </span>
                </div>
            </div>
        </header>
    );
}
