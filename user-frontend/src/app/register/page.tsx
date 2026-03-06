'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerSchema, RegisterFormData } from '@/lib/schemas';
import api from '@/lib/axios';
import { Loader2 } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

export default function RegisterPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState('');

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
    });

    const onSubmit = async (data: RegisterFormData) => {
        try {
            setLoading(true);
            setServerError('');
            // Send the data excluding the confirmPassword field that frontend uses for validation
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { confirmPassword: _cp, ...payload } = data;
            await api.post('/auth/register', payload);
            // On success -> redirect to /login
            router.push('/login');
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            setServerError(
                err.response?.data?.message || 'Registration failed. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
        if (!credentialResponse.credential) {
            setServerError('Google Sign-Up failed. No credential received.');
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
                window.location.href = '/dashboard';
            }
        } catch (error: unknown) {
            const err = error as { response?: { status?: number; data?: { message?: string } } };
            setServerError(err.response?.data?.message || 'Google Sign-Up failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
                    <p className="text-gray-500 mt-2 text-sm">Join the skill era</p>
                </div>

                {serverError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                        {serverError}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Full Name
                        </label>
                        <input
                            {...register('name')}
                            type="text"
                            disabled={loading}
                            className={`w-full px-4 py-2 rounded-xl border ${errors.name ? 'border-red-300' : 'border-gray-200'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            placeholder="John Doe"
                        />
                        {errors.name && (
                            <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email Address
                        </label>
                        <input
                            {...register('email')}
                            type="email"
                            disabled={loading}
                            className={`w-full px-4 py-2 rounded-xl border ${errors.email ? 'border-red-300' : 'border-gray-200'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            placeholder="you@example.com"
                        />
                        {errors.email && (
                            <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Mobile Number
                        </label>
                        <input
                            {...register('mobile')}
                            type="tel"
                            disabled={loading}
                            className={`w-full px-4 py-2 rounded-xl border ${errors.mobile ? 'border-red-300' : 'border-gray-200'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            placeholder="9876543210"
                        />
                        {errors.mobile && (
                            <p className="text-red-500 text-xs mt-1">{errors.mobile.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date of Birth
                        </label>
                        <input
                            {...register('dateOfBirth')}
                            type="date"
                            disabled={loading}
                            className={`w-full px-4 py-2 rounded-xl border ${errors.dateOfBirth ? 'border-red-300' : 'border-gray-200'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        {errors.dateOfBirth && (
                            <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            State
                        </label>
                        <input
                            {...register('state')}
                            type="text"
                            disabled={loading}
                            className={`w-full px-4 py-2 rounded-xl border ${errors.state ? 'border-red-300' : 'border-gray-200'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            placeholder="Maharashtra"
                        />
                        {errors.state && (
                            <p className="text-red-500 text-xs mt-1">{errors.state.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            {...register('password')}
                            type="password"
                            disabled={loading}
                            className={`w-full px-4 py-2 rounded-xl border ${errors.password ? 'border-red-300' : 'border-gray-200'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            placeholder="••••••••"
                        />
                        {errors.password && (
                            <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Confirm Password
                        </label>
                        <input
                            {...register('confirmPassword')}
                            type="password"
                            disabled={loading}
                            className={`w-full px-4 py-2 rounded-xl border ${errors.confirmPassword ? 'border-red-300' : 'border-gray-200'
                                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                            placeholder="••••••••"
                        />
                        {errors.confirmPassword && (
                            <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
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
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 mt-4"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
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
                            onError={() => setServerError('Google Sign-Up failed. Please try again.')}
                            useOneTap
                        />
                    </div>
                </form>

                <div className="mt-6 text-center text-sm text-gray-500">
                    Already have an account?{' '}
                    <Link href="/login" className="text-blue-600 hover:underline font-medium">
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
