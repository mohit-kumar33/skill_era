'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Trophy, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import type { ApiResponse, LoginResponse } from '@/lib/types';

const loginSchema = z.object({
    mobile: z.string().min(10, 'Mobile number required').max(15),
    password: z.string().min(1, 'Password required'),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginFormContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get('redirect') ?? '/dashboard';
    const [serverError, setServerError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginForm) => {
        setServerError('');
        setIsSubmitting(true);

        try {
            await api.post<ApiResponse<LoginResponse>>('/auth/login', data);
            // Cookies are set automatically by the backend
            router.push(redirect);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setServerError(
                axiosErr.response?.data?.message ?? 'Login failed. Please try again.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="mb-8 flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
                        <Trophy className="h-7 w-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Skill Era Admin</h1>
                    <p className="text-sm text-zinc-500">Sign in to your admin account</p>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl"
                >
                    {serverError && (
                        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {serverError}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-400">
                                Mobile Number
                            </label>
                            <input
                                {...register('mobile')}
                                type="text"
                                placeholder="+919876543210"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                            {errors.mobile && (
                                <p className="mt-1 text-xs text-red-400">{errors.mobile.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-400">
                                Password
                            </label>
                            <input
                                {...register('password')}
                                type="password"
                                placeholder="••••••••"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                            {errors.password && (
                                <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isSubmitting ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-zinc-950">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        }>
            <LoginFormContent />
        </Suspense>
    );
}
