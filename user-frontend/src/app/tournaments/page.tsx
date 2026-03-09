'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { Loader2, Trophy, Users, Clock, Swords, CheckCircle2, AlertCircle, X, Wallet } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

async function fetchTournaments(): Promise<any[]> {
    const res = await api.get('/tournaments?status=open');
    return res.data?.data?.tournaments || [];
}

export default function TournamentsPage() {
    const queryClient = useQueryClient();
    const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const [joinStatus, setJoinStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [joinMessage, setJoinMessage] = useState('');

    const { data: tournaments, isLoading, isError } = useQuery({
        queryKey: ['tournaments'],
        queryFn: fetchTournaments,
        refetchInterval: 15000,
    });

    const openJoinModal = (t: any) => {
        setJoinStatus('idle');
        setJoinMessage('');
        setSelectedTournament(t);
    };

    const confirmJoin = async () => {
        if (!selectedTournament) return;

        try {
            setIsJoining(true);
            setJoinStatus('idle');
            setJoinMessage('');

            await api.post(`/tournaments/${selectedTournament.id}/join`, {
                idempotencyKey: `join-${selectedTournament.id}-${Date.now()}`
            });

            setJoinStatus('success');
            setJoinMessage(`Successfully joined ${selectedTournament.title}!`);

            // Refresh counts and balances
            queryClient.invalidateQueries({ queryKey: ['tournaments'] });
            queryClient.invalidateQueries({ queryKey: ['wallet'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });

            // Auto close modal after showing success for a brief moment
            setTimeout(() => {
                setSelectedTournament(null);
            }, 2000);

        } catch (err: any) {
            setJoinStatus('error');
            const message = err.response?.data?.message?.toLowerCase() || '';
            if (message.includes('balance') || message.includes('insufficient')) {
                setJoinMessage('Insufficient balance to join. Please deposit funds.');
            } else {
                setJoinMessage(err.response?.data?.message || 'Failed to join tournament. It may be full.');
            }
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <div className="min-h-screen bg-app-bg text-text-primary pb-28 relative">
            {/* Header */}
            <div className="px-5 pt-8 pb-6 border-b border-app-cardBorder bg-app-card/30 sticky top-0 z-10 backdrop-blur-md">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-text-secondary bg-clip-text text-transparent">
                    Live Tournaments
                </h1>
                <p className="text-text-secondary text-sm mt-1">Compete and win real money</p>
            </div>

            <div className="px-5 mt-6 mx-auto max-w-2xl">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-accent-cyanText" />
                        <p className="text-text-secondary text-sm font-medium animate-pulse">Loading arenas...</p>
                    </div>
                ) : isError ? (
                    <div className="bg-app-card border border-app-cardBorder rounded-2xl p-8 text-center">
                        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3 opacity-50" />
                        <p className="text-text-secondary text-sm">Failed to load tournaments. Please try again.</p>
                        <button
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['tournaments'] })}
                            className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                ) : !tournaments || tournaments.length === 0 ? (
                    <div className="bg-app-card border border-app-cardBorder border-dashed rounded-3xl p-12 text-center shadow-lg">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trophy className="w-8 h-8 text-text-secondary" />
                        </div>
                        <h3 className="text-lg font-bold mb-1">No Open Tournaments</h3>
                        <p className="text-text-secondary text-sm">Check back later for upcoming matches!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {tournaments.map((t) => {
                            const availableSlots = t.maxParticipants - (t.participantCount || 0);
                            const isFull = availableSlots <= 0;
                            const startsIn = formatDistanceToNow(new Date(t.scheduledAt), { addSuffix: true });

                            return (
                                <div key={t.id} className="group bg-app-card border border-app-cardBorder rounded-3xl p-5 shadow-sm hover:border-white/10 transition-all duration-300 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent-cyanText/5 rounded-bl-[100px] pointer-events-none transition-transform group-hover:scale-110"></div>

                                    <div className="relative z-10 flex flex-col gap-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-3 items-center">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-app-bg to-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                                                    <Swords className="w-6 h-6 text-accent-cyanText" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-[10px] uppercase tracking-wider font-bold text-accent-cyanText bg-accent-cyanText/10 px-2 py-0.5 rounded-md">
                                                            {t.gameType}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-[10px] text-text-secondary bg-white/5 px-2 py-0.5 rounded-md">
                                                            <Clock className="w-3 h-3" /> {startsIn}
                                                        </span>
                                                    </div>
                                                    <h3 className="font-bold text-lg text-white group-hover:text-accent-cyanText transition-colors">{t.title}</h3>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-app-bg/50 rounded-xl p-3 border border-app-cardBorder/50">
                                                <p className="text-[10px] uppercase text-text-secondary font-semibold mb-1">Entry Fee</p>
                                                <p className="text-sm font-bold text-white">₹{t.entryFee}</p>
                                            </div>
                                            <div className="bg-gradient-to-b from-accent-goldText/10 to-transparent rounded-xl p-3 border border-accent-goldText/20">
                                                <p className="text-[10px] uppercase text-accent-goldText/80 font-semibold mb-1">Prize Pool</p>
                                                <p className="text-sm font-bold text-accent-goldText">₹{t.prizePool}</p>
                                            </div>
                                            <div className="bg-app-bg/50 rounded-xl p-3 border border-app-cardBorder/50">
                                                <p className="text-[10px] uppercase text-text-secondary font-semibold mb-1">Players</p>
                                                <p className={`text-sm font-bold flex items-center gap-1 ${isFull ? 'text-red-400' : 'text-white'}`}>
                                                    <Users className="w-3.5 h-3.5" />
                                                    {t.participantCount || 0} / {t.maxParticipants}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <button
                                                onClick={() => openJoinModal(t)}
                                                disabled={isFull}
                                                className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${isFull
                                                        ? 'bg-app-bg text-text-secondary border border-app-cardBorder cursor-not-allowed'
                                                        : 'bg-accent-cyanText hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(45,212,191,0.3)] hover:shadow-[0_0_20px_rgba(45,212,191,0.5)]'
                                                    }`}
                                            >
                                                {isFull ? (
                                                    'Arena Full'
                                                ) : (
                                                    <><Swords className="w-4 h-4" /> Join Tournament</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Join Confirmation Modal overlay */}
            {selectedTournament && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-app-card border border-app-cardBorder w-full max-w-sm rounded-[28px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">

                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-b from-white/5 to-transparent">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Swords className="w-5 h-5 text-accent-cyanText" />
                                Confirm Entry
                            </h2>
                            <button
                                onClick={() => !isJoining && setSelectedTournament(null)}
                                disabled={isJoining}
                                className="p-2 -mr-2 text-text-secondary hover:text-white rounded-full hover:bg-white/5 transition-colors disabled:opacity-50"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6">

                            <div className="text-center space-y-1">
                                <span className="text-[10px] uppercase tracking-wider font-bold text-accent-cyanText bg-accent-cyanText/10 px-2 py-0.5 rounded-md inline-block mb-2">
                                    {selectedTournament.gameType}
                                </span>
                                <h3 className="font-bold text-xl text-white leading-tight">{selectedTournament.title}</h3>
                            </div>

                            <div className="bg-app-bg/50 rounded-2xl p-4 border border-app-cardBorder/50 space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-text-secondary flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Entry Fee</span>
                                    <span className="font-bold text-white max-text text-lg">₹{selectedTournament.entryFee}</span>
                                </div>
                                <div className="h-px bg-white/5 w-full"></div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-accent-goldText/80 flex items-center gap-1.5"><Trophy className="w-4 h-4" /> Prize Pool</span>
                                    <span className="font-bold text-accent-goldText text-lg">₹{selectedTournament.prizePool}</span>
                                </div>
                            </div>

                            {/* Status Messages inside Modal */}
                            {joinStatus === 'error' && (
                                <div className="p-3 bg-red-500/10 text-red-400 text-xs rounded-xl border border-red-500/20 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <p>{joinMessage}</p>
                                </div>
                            )}
                            {joinStatus === 'success' && (
                                <div className="p-3 bg-emerald-500/10 text-emerald-400 text-xs rounded-xl border border-emerald-500/20 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <p>{joinMessage}</p>
                                </div>
                            )}

                            {/* Action Button */}
                            <button
                                onClick={confirmJoin}
                                disabled={isJoining || joinStatus === 'success'}
                                className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-accent-cyanText hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(45,212,191,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                            >
                                {isJoining ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Processing Payment...</>
                                ) : joinStatus === 'success' ? (
                                    <><CheckCircle2 className="w-5 h-5" /> Joined Successfully</>
                                ) : (
                                    `Pay ₹${selectedTournament.entryFee} to Join`
                                )}
                            </button>

                            <p className="text-[10px] text-center text-text-secondary mt-4 px-4 leading-relaxed">
                                By joining, ₹{selectedTournament.entryFee} will be deducted from your deposit balance. This action cannot be reversed.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
