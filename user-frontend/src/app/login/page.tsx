'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginSchema, LoginFormData } from '@/lib/schemas';
import api from '@/lib/axios';
import { Loader2 } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnUrl = searchParams.get('returnUrl') || '/dashboard';

    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState('');

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        try {
            setLoading(true);
            setServerError('');
            await api.post('/auth/login', {
                identifier: data.identifier,
                password: data.password,
                cfTurnstileResponse: data.cfTurnstileResponse,
            });
        } catch (error: unknown) {
            const err = error as { response?: { status?: number; data?: { message?: string } } };
            if (err.response?.status === 401) {
                setServerError('Invalid email/mobile or password');
            } else {
                setServerError(err.response?.data?.message || 'Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        if (!credentialResponse.credential) {
            setServerError('Google Login failed. No credential received.');
            return;
        }

        try {
            setLoading(true);
            setServerError('');

            const res = await api.post('/auth/google', {
                idToken: credentialResponse.credential
            });

            if (res.data?.data?.profileIncomplete) {
                window.location.href = '/complete-profile';
            } else {
                window.location.href = returnUrl;
            }
        } catch (error: unknown) {
            const err = error as { response?: { status?: number; data?: { message?: string } } };
            setServerError(err.response?.data?.message || 'Google Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
                    <p className="text-gray-500 mt-2 text-sm">Sign in to your Skill Era account</p>
                </div>

                {serverError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                        {serverError}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email or Mobile
                        </label>
                        <input
                            {...register('identifier')}
                            type="text"
                            disabled={loading || isSubmitting}
                            className={`w-full px-4 py-2 rounded-xl border ${errors.identifier ? 'border-red-300' : 'border-gray-200'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow`}
                            placeholder="you@example.com or mobile number"
                        />
                        {errors.identifier && (
                            <p className="text-red-500 text-xs mt-1">{errors.identifier.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            {...register('password')}
                            type="password"
                            disabled={loading || isSubmitting}
                            className={`w-full px-4 py-2 rounded-xl border ${errors.password ? 'border-red-300' : 'border-gray-200'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow`}
                            placeholder="••••••••"
                        />
                        {errors.password && (
                            <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
                        )}
                    </div>

                    <div className="flex flex-col items-center py-2">
                        <Turnstile
                            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
                            onSuccess={(token) => setValue('cfTurnstileResponse', token, { shouldValidate: true })}
                            onError={() => setServerError('Captcha verification failed. Please refresh the page.')}
                            options={{ theme: 'light' }}
                        />
                        {errors.cfTurnstileResponse && (
                            <p className="text-red-500 text-xs mt-2">{errors.cfTurnstileResponse.message}</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || isSubmitting}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log In'}
                    </button>

                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Or continue with</span>
                        </div>
                    </div>

                    <div className="flex justify-center w-full">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => setServerError('Google Login failed. Please try again.')}
                            useOneTap
                        />
                    </div>
                </form>

                <div className="mt-6 text-center text-sm text-gray-500">
                    Don&apos;t have an account?{' '}
                    <Link href="/register" className="text-blue-600 hover:underline font-medium">
                        Register now
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
