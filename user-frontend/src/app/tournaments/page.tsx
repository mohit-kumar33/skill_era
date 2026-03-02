'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { Tournament } from '@/lib/types';
import { Loader2, Trophy, Users, Clock } from 'lucide-react';

async function fetchTournaments(): Promise<Tournament[]> {
    const res = await api.get('/tournaments/list?format=1v1');
    const items = res.data?.data?.tournaments || [];
    return items.map((t: Record<string, any>) => ({
        id: t.id,
        title: t.title,
        format: '1v1',
        entry_fee: parseFloat(t.entryFee || '0'),
        prize_pool: parseFloat(t.prizePool || '0'),
        slots_total: t.maxParticipants,
        slots_filled: t.participantCount || 0,
        start_time: t.scheduledAt,
        status: t.status,
    }));
}

function statusBadge(status: string) {
    switch (status) {
        case 'upcoming': return 'bg-blue-50 text-blue-700';
        case 'ongoing': return 'bg-green-50 text-green-700';
        case 'completed': return 'bg-gray-100 text-gray-500';
        case 'cancelled': return 'bg-red-50 text-red-600';
        default: return 'bg-gray-100 text-gray-500';
    }
}

export default function TournamentsPage() {
    const { data: tournaments, isLoading, error } = useQuery({
        queryKey: ['tournaments'],
        queryFn: fetchTournaments,
    });

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">1v1 Tournaments</h1>
                    <p className="text-sm text-gray-500 mt-1">Find and join available tournaments</p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 rounded-2xl p-6 text-sm text-center">
                        Failed to load tournaments. Please refresh.
                    </div>
                ) : !tournaments || tournaments.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
                        <Trophy className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">No tournaments available right now. Check back soon!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {tournaments.map((t) => (
                            <div
                                key={t.id}
                                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{t.title}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${statusBadge(t.status)}`}>
                                            {t.status}
                                        </span>
                                    </div>
                                    {t.is_joined && (
                                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
                                            Joined ✓
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="bg-gray-50 rounded-xl p-2">
                                        <p className="text-xs text-gray-400">Entry Fee</p>
                                        <p className="text-sm font-bold text-gray-800">₹{t.entry_fee}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-2">
                                        <p className="text-xs text-gray-400">Prize Pool</p>
                                        <p className="text-sm font-bold text-green-700">₹{t.prize_pool}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-2">
                                        <p className="text-xs text-gray-400">Slots</p>
                                        <p className="text-sm font-bold text-gray-800 flex items-center justify-center gap-1">
                                            <Users className="w-3 h-3" />
                                            {t.slots_total - t.slots_filled} left
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1 text-xs text-gray-400">
                                        <Clock className="w-3 h-3" />
                                        {new Date(t.start_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                    </div>
                                    <Link
                                        href={`/tournaments/${t.id}`}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded-xl transition-colors"
                                    >
                                        View Details
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
