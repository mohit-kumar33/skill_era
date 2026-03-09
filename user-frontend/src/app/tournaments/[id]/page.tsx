'use client';

import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import { Tournament, TournamentResult } from '@/lib/types';
import { Loader2, Users, Clock, Upload, AlertCircle } from 'lucide-react';

const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

async function fetchTournament(id: string): Promise<Tournament> {
    const res = await api.get(`/tournaments/${id}`);
    const t = res.data?.data;
    if (!t) throw new Error('Not found');
    return {
        id: t.id,
        title: t.title,
        format: '1v1',
        entry_fee: parseFloat(t.entryFee || '0'),
        prize_pool: parseFloat(t.prizePool || '0'),
        slots_total: t.maxParticipants,
        slots_filled: t.participants?.length || 0,
        start_time: t.scheduledAt,
        status: t.status,
        is_joined: t.isJoined || false,
    };
}

async function fetchResult(id: string): Promise<TournamentResult | null> {
    try {
        const res = await api.get(`/tournaments/${id}/result`);
        const r = res.data?.data;
        if (!r) return null;
        return {
            id: r.id,
            match_id: r.externalMatchId || '',
            status: r.status,
            submitted_at: r.createdAt
        };
    } catch {
        return null;
    }
}

function resultStatusColor(status: string) {
    switch (status) {
        case 'Approved': return 'text-green-600 bg-green-50';
        case 'Rejected': return 'text-red-600 bg-red-50';
        case 'Submitted': case 'Under Review': return 'text-amber-600 bg-amber-50';
        default: return 'text-gray-600 bg-gray-100';
    }
}

export default function TournamentDetailPage() {
    const params = useParams<{ id: string }>();
    const id = params.id;
    const queryClient = useQueryClient();

    const [joinLoading, setJoinLoading] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [joinSuccess, setJoinSuccess] = useState('');

    const [file, setFile] = useState<File | null>(null);
    const [matchId, setMatchId] = useState('');
    const [fileError, setFileError] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        data: tournament,
        isLoading,
        error,
        refetch: refetchTournament,
    } = useQuery({ queryKey: ['tournament', id], queryFn: () => fetchTournament(id) });

    const { data: result, refetch: refetchResult } = useQuery({
        queryKey: ['tournament-result', id],
        queryFn: () => fetchResult(id),
    });

    const handleJoin = async () => {
        try {
            setJoinLoading(true);
            setJoinError('');
            setJoinSuccess('');
            await api.post('/tournaments/join', { tournament_id: id });
            setJoinSuccess('Successfully joined the tournament!');
            // Refetch both tournament data AND wallet balance
            await Promise.all([
                refetchTournament(),
                queryClient.invalidateQueries({ queryKey: ['wallet'] }),
            ]);
        } catch (error: unknown) {
            const err = error as { response?: { status?: number; data?: { message?: string } } };
            if (err.response?.status === 409) {
                setJoinError('This action was already completed. You are already in this tournament.');
            } else if (err.response?.data?.message?.toLowerCase().includes('balance') || err.response?.data?.message?.toLowerCase().includes('insufficient')) {
                setJoinError('Insufficient balance. Please deposit funds to join.');
            } else {
                setJoinError(err.response?.data?.message || 'Failed to join. Tournament may be full.');
            }
        } finally {
            setJoinLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        setFileError('');
        if (!selected) return;
        if (!ALLOWED_TYPES.includes(selected.type)) {
            setFileError('Only JPEG and PNG images are accepted.');
            e.target.value = '';
            return;
        }
        if (selected.size > MAX_SIZE_BYTES) {
            setFileError('File size must be 5MB or less.');
            e.target.value = '';
            return;
        }
        setFile(selected);
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) { setFileError('Please select a screenshot to upload.'); return; }
        if (!matchId.trim()) { setUploadError('Match ID is required.'); return; }

        try {
            setUploading(true);
            setUploadError('');
            setUploadSuccess('');
            setUploadProgress(10); // starting step 1

            // Step 1: Get presigned URL mapping to the new endpoint
            const presignedRes = await api.post(`/tournaments/${id}/result/presigned-url`, {
                fileName: file.name,
                contentType: file.type
            });

            const { url, signedUploadUrl } = presignedRes.data.data;

            // Step 2: Upload directly to S3 (requires raw axios to avoid our interceptors sending tokens to S3)
            const axios = (await import('axios')).default;
            await axios.put(signedUploadUrl, file, {
                headers: { 'Content-Type': file.type },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        // allocate 10% to 90% for the upload phase
                        const percent = Math.round((progressEvent.loaded * 80) / progressEvent.total);
                        setUploadProgress(10 + percent);
                    }
                },
            });

            setUploadProgress(95);

            // Step 3: Inform our backend that upload is complete
            await api.post(`/tournaments/${id}/result/upload`, {
                matchId: matchId.trim(),
                screenshotUrl: url
            });

            setUploadProgress(100);
            setUploadSuccess('Result submitted! It is now under review.');
            setFile(null);
            setMatchId('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            refetchResult();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            setUploadError(err.response?.data?.message || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
            setTimeout(() => setUploadProgress(0), 1000);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error || !tournament) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-red-50 text-red-600 rounded-2xl p-6 text-sm text-center max-w-sm w-full">
                    Failed to load tournament. Please go back and try again.
                </div>
            </div>
        );
    }

    const slotsLeft = tournament.slots_total - tournament.slots_filled;
    const isFull = slotsLeft <= 0;

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Tournament Info */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                    <div className="flex items-start justify-between">
                        <h1 className="text-xl font-bold text-gray-900">{tournament.title}</h1>
                        {tournament.is_joined && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">Joined ✓</span>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400">Entry Fee</p>
                            <p className="text-base font-bold text-gray-900">₹{tournament.entry_fee}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400">Prize Pool</p>
                            <p className="text-base font-bold text-green-700">₹{tournament.prize_pool}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400">Slots Left</p>
                            <p className="text-base font-bold text-gray-900 flex items-center justify-center gap-1">
                                <Users className="w-3.5 h-3.5" />{slotsLeft}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(tournament.start_time).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
                    </div>
                </div>

                {/* Join Section */}
                {!tournament.is_joined && tournament.status === 'upcoming' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-sm font-semibold text-gray-700 mb-4">Join Tournament</h2>
                        {joinError && (
                            <div className="mb-3 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                {joinError}
                            </div>
                        )}
                        {joinSuccess && (
                            <div className="mb-3 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100">
                                {joinSuccess}
                            </div>
                        )}
                        {isFull ? (
                            <p className="text-sm text-red-500 text-center py-2">This tournament is full.</p>
                        ) : (
                            <button
                                onClick={handleJoin}
                                disabled={joinLoading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {joinLoading ? (
                                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Joining...</>
                                ) : (
                                    `Join for ₹${tournament.entry_fee}`
                                )}
                            </button>
                        )}
                    </div>
                )}

                {/* Result Submission */}
                {tournament.is_joined && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-sm font-semibold text-gray-700 mb-4">Submit Result</h2>

                        {result ? (
                            <div className="space-y-3">
                                <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${resultStatusColor(result.status)}`}>
                                    <span className="text-sm font-medium">Result Status</span>
                                    <span className="font-bold">{result.status}</span>
                                </div>
                                <p className="text-xs text-gray-400 text-center">
                                    Submitted {new Date(result.submitted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleUpload} className="space-y-4">
                                {uploadError && (
                                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                                        {uploadError}
                                    </div>
                                )}
                                {uploadSuccess && (
                                    <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100">
                                        {uploadSuccess}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Match ID</label>
                                    <input
                                        type="text"
                                        value={matchId}
                                        onChange={(e) => setMatchId(e.target.value)}
                                        disabled={uploading}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                                        placeholder="Enter your match ID"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Screenshot (JPEG/PNG, max 5MB)
                                    </label>
                                    <div
                                        className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-300 transition-colors"
                                        onClick={() => !uploading && fileInputRef.current?.click()}
                                    >
                                        <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                        {file ? (
                                            <p className="text-sm text-gray-700 font-medium">{file.name}</p>
                                        ) : (
                                            <p className="text-sm text-gray-400">Click to select screenshot</p>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png"
                                        onChange={handleFileChange}
                                        disabled={uploading}
                                        className="hidden"
                                    />
                                    {fileError && (
                                        <p className="text-red-500 text-xs mt-1">{fileError}</p>
                                    )}
                                </div>

                                {uploading && (
                                    <div>
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                            <span>Uploading...</span>
                                            <span>{uploadProgress}%</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={uploading || !file}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploading ? (
                                        <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Uploading...</>
                                    ) : (
                                        'Submit Result'
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
