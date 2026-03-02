'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import type { ApiResponse, TournamentsResponse, CreateTournamentRequest } from '@/lib/types';
import { PageLoader } from '@/components/LoadingSpinner';
import ErrorAlert from '@/components/ErrorAlert';
import StatusBadge from '@/components/StatusBadge';
import PaginationControls from '@/components/Pagination';
import Modal from '@/components/Modal';
import { Plus, Loader2 } from 'lucide-react';

const createSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters'),
    gameType: z.string().min(1, 'Game type required'),
    entryFee: z.coerce.number().min(10, 'Minimum ₹10'),
    prizePool: z.coerce.number().default(0),
    commissionPercent: z.coerce.number().min(10).max(20),
    maxParticipants: z.coerce.number().min(2).max(10000),
    scheduledAt: z.string().min(1, 'Schedule date required'),
});

type CreateForm = z.infer<typeof createSchema>;

export default function TournamentsPage() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [showCreate, setShowCreate] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: ['tournaments', page],
        queryFn: async () => {
            const res = await api.get<ApiResponse<TournamentsResponse>>(
                `/tournaments/list?page=${page}&limit=20`
            );
            return res.data.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (input: CreateTournamentRequest) => {
            await api.post('/tournaments/create', input);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tournaments'] });
            setShowCreate(false);
            reset();
        },
    });

    type CreateFormInput = z.input<typeof createSchema>;

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors: formErrors },
    } = useForm<CreateFormInput>({
        resolver: zodResolver(createSchema),
        defaultValues: {
            entryFee: 0,
            prizePool: 0,
            maxParticipants: 2,
            commissionPercent: 10,
        },
    });

    const onSubmit = (data: CreateFormInput) => {
        const parsed = createSchema.parse(data);
        createMutation.mutate({
            ...parsed,
            entryFee: String(parsed.entryFee),
            prizePool: String(parsed.prizePool),
            scheduledAt: new Date(parsed.scheduledAt).toISOString(),
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Tournaments</h1>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500"
                >
                    <Plus className="h-4 w-4" />
                    Create Tournament
                </button>
            </div>

            {isLoading && <PageLoader />}
            {error && <ErrorAlert error={error as Error} />}

            {data && (
                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-zinc-800">
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Title</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Game</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Entry Fee</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Prize Pool</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Players</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Scheduled</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {data.tournaments.map((t) => (
                                    <tr key={t.id} className="transition-colors hover:bg-zinc-800/30">
                                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-white">{t.title}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">{t.gameType}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-300">₹{Number(t.entryFee).toLocaleString()}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-emerald-400">₹{Number(t.prizePool).toLocaleString()}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-400">
                                            {t._count?.participants ?? 0}/{t.maxParticipants}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3"><StatusBadge status={t.status} /></td>
                                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-500">
                                            {new Date(t.scheduledAt).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls pagination={data.pagination} onPageChange={setPage} />
                </div>
            )}

            {/* Create Modal */}
            <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Tournament">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <Field label="Title" error={formErrors.title?.message}>
                        <input {...register('title')} className="form-input" placeholder="Weekend Clash" />
                    </Field>
                    <Field label="Game Type" error={formErrors.gameType?.message}>
                        <input {...register('gameType')} className="form-input" placeholder="chess" />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Entry Fee (₹)" error={formErrors.entryFee?.message}>
                            <input {...register('entryFee')} type="number" className="form-input" placeholder="50" />
                        </Field>
                        <Field label="Commission %" error={formErrors.commissionPercent?.message}>
                            <input {...register('commissionPercent')} type="number" className="form-input" />
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Max Players" error={formErrors.maxParticipants?.message}>
                            <input {...register('maxParticipants')} type="number" className="form-input" />
                        </Field>
                        <Field label="Scheduled At" error={formErrors.scheduledAt?.message}>
                            <input {...register('scheduledAt')} type="datetime-local" className="form-input" />
                        </Field>
                    </div>

                    {createMutation.error && <ErrorAlert error={createMutation.error as Error} />}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowCreate(false)}
                            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                        >
                            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Create
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

function Field({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">{label}</label>
            {children}
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </div>
    );
}
