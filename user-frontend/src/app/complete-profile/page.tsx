'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

const mobileSchema = z.object({
    mobile: z.string().length(10).regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
});

type CompleteProfileForm = z.infer<typeof mobileSchema>;

export default function CompleteProfilePage() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<CompleteProfileForm>({
        resolver: zodResolver(mobileSchema),
    });

    const onSubmit = async (data: CompleteProfileForm) => {
        try {
            setServerError(null);

            // Send the new mobile number to our new backend endpoint
            await api.put('/users/me/mobile', data);

            // Refresh the user context so the app knows the profile is complete
            await queryClient.invalidateQueries({ queryKey: ['user'] });

            // Redirect to dashboard
            router.push('/dashboard');
        } catch (error: any) {
            setServerError(error.response?.data?.error || 'Failed to update profile. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Complete Your Profile</h1>
                    <p className="text-gray-500 mt-2">
                        You signed in successfully with Google! Just one more step: we need your mobile number to secure your account.
                    </p>
                </div>

                {serverError && (
                    <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex items-start">
                        <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span>{serverError}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Mobile Number
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-2 text-gray-500 font-medium">+91</span>
                            <input
                                {...register('mobile')}
                                type="tel"
                                disabled={isSubmitting}
                                className={`w-full pl-12 pr-4 py-2 rounded-xl border ${errors.mobile ? 'border-red-300' : 'border-gray-200'
                                    } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow`}
                                placeholder="9876543210"
                                maxLength={10}
                            />
                        </div>
                        {errors.mobile && (
                            <p className="text-red-500 text-xs mt-1">{errors.mobile.message}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                            Used for account recovery and important alerts. We never spam.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-70 flex items-center justify-center space-x-2"
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Saving...</span>
                            </>
                        ) : (
                            <span>Finish Setup</span>
                        )}
                    </button>

                    <div className="text-center mt-4 pt-4 border-t border-gray-100">
                        <Link
                            href="/login"
                            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                        >
                            Cancel and return to login
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
