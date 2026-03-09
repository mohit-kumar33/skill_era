'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { Loader2, ArrowLeft, CreditCard, Smartphone, Building, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function DepositPage() {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState('500');
    const [amountError, setAmountError] = useState('');
    const [loadingMethod, setLoadingMethod] = useState<string | null>(null);
    const [serverError, setServerError] = useState('');

    const presetAmounts = [100, 500, 1000, 5000];

    const validate = (): number | null => {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) {
            setAmountError('Enter a valid amount');
            return null;
        }
        if (parsed < 100) {
            setAmountError('Minimum deposit is ₹100');
            return null;
        }
        setAmountError('');
        return parsed;
    };

    const handleDeposit = async (method: string) => {
        const parsed = validate();
        if (parsed === null) return;

        try {
            setLoadingMethod(method);
            setServerError('');

            // The method can be passed to the backend if you are using seamless/headless Cashfree.
            // But since the requirement is to redirect, we just hit the initiate endpoint 
            // and redirect to the returned paymentUrl (Cashfree hosted checkout).
            const res = await api.post('/wallet/deposit', { amount: parsed });

            const paymentUrl = res.data?.data?.paymentUrl;

            if (paymentUrl) {
                // Redirect user to Cashfree payment gateway
                window.location.href = paymentUrl;
            } else {
                // If paymentUrl is missing, redirect to wallet and poll
                window.location.href = '/wallet';
            }
        } catch (error: any) {
            setServerError(error.response?.data?.message || 'Failed to initiate deposit. Please try again.');
            setLoadingMethod(null);
        }
    };

    return (
        <div className="min-h-screen bg-app-bg text-text-primary pb-28">
            {/* Header */}
            <div className="px-5 pt-6 pb-4 flex items-center gap-4 border-b border-app-cardBorder bg-app-card/50 sticky top-0 z-10 backdrop-blur-md">
                <Link href="/wallet" className="w-10 h-10 rounded-full bg-app-card border border-app-cardBorder flex items-center justify-center hover:border-text-secondary transition-colors">
                    <ArrowLeft className="w-5 h-5 text-text-secondary" />
                </Link>
                <div>
                    <h1 className="text-xl font-bold">Add Funds</h1>
                    <p className="text-text-secondary text-xs mt-0.5">100% Secure Payments</p>
                </div>
            </div>

            <div className="px-5 mt-6 space-y-6 max-w-lg mx-auto">
                {/* ── Amount Input ────────────────────── */}
                <div className="bg-app-card border border-app-cardBorder rounded-3xl p-6 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-accent-cyanText"></div>

                    <label className="block text-sm font-medium text-text-secondary mb-3">Enter Amount</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary text-2xl font-bold">₹</span>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => { setAmount(e.target.value); setAmountError(''); }}
                            disabled={!!loadingMethod}
                            className={`w-full pl-11 pr-4 py-4 rounded-2xl bg-app-bg border text-2xl font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${amountError ? 'border-red-500/50' : 'border-app-cardBorder focus:border-emerald-500/40'
                                }`}
                            placeholder="0"
                        />
                    </div>
                    {amountError && <p className="text-red-400 text-xs mt-2 font-medium">{amountError}</p>}

                    <div className="flex gap-2 mt-4 overflow-x-auto pb-1 no-scrollbar">
                        {presetAmounts.map((v) => (
                            <button
                                key={v}
                                onClick={() => { setAmount(v.toString()); setAmountError(''); }}
                                disabled={!!loadingMethod}
                                className={`flex-1 min-w-[70px] py-2.5 text-sm font-semibold rounded-xl border transition-all ${amount === v.toString()
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                    : 'bg-app-bg border-app-cardBorder text-text-secondary hover:border-white/20'
                                    }`}
                            >
                                +₹{v}
                            </button>
                        ))}
                    </div>
                </div>

                {serverError && (
                    <div className="p-4 bg-red-500/10 text-red-400 text-sm rounded-2xl border border-red-500/20 flex items-start gap-3">
                        <div className="mt-0.5">⚠️</div>
                        <p>{serverError}</p>
                    </div>
                )}

                {/* ── Payment Methods ─────────────────── */}
                <div>
                    <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 px-1 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Select Payment Method
                    </h2>

                    <div className="space-y-3">
                        <button
                            onClick={() => handleDeposit('upi')}
                            disabled={!!loadingMethod}
                            className="w-full bg-app-card border border-app-cardBorder rounded-2xl p-4 flex items-center justify-between hover:border-emerald-500/40 transition-all group disabled:opacity-60"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                                    <Smartphone className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-text-primary">Pay via UPI</p>
                                    <p className="text-xs text-text-secondary mt-0.5">GPay, PhonePe, Paytm</p>
                                </div>
                            </div>
                            {loadingMethod === 'upi' ? (
                                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-app-bg border border-app-cardBorder flex items-center justify-center text-text-secondary group-hover:text-emerald-400 group-hover:border-emerald-400/30 transition-colors">
                                    →
                                </div>
                            )}
                        </button>

                        <button
                            onClick={() => handleDeposit('card')}
                            disabled={!!loadingMethod}
                            className="w-full bg-app-card border border-app-cardBorder rounded-2xl p-4 flex items-center justify-between hover:border-accent-purpleText/40 transition-all group disabled:opacity-60"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-purpleText/20 to-accent-purpleText/5 flex items-center justify-center text-accent-purpleText group-hover:scale-110 transition-transform">
                                    <CreditCard className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-text-primary">Pay via Card</p>
                                    <p className="text-xs text-text-secondary mt-0.5">Visa, Mastercard, RuPay</p>
                                </div>
                            </div>
                            {loadingMethod === 'card' ? (
                                <Loader2 className="w-5 h-5 animate-spin text-accent-purpleText" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-app-bg border border-app-cardBorder flex items-center justify-center text-text-secondary group-hover:text-accent-purpleText group-hover:border-accent-purpleText/30 transition-colors">
                                    →
                                </div>
                            )}
                        </button>

                        <button
                            onClick={() => handleDeposit('netbanking')}
                            disabled={!!loadingMethod}
                            className="w-full bg-app-card border border-app-cardBorder rounded-2xl p-4 flex items-center justify-between hover:border-accent-cyanText/40 transition-all group disabled:opacity-60"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-cyanText/20 to-accent-cyanText/5 flex items-center justify-center text-accent-cyanText group-hover:scale-110 transition-transform">
                                    <Building className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-text-primary">Net Banking</p>
                                    <p className="text-xs text-text-secondary mt-0.5">All major Indian banks</p>
                                </div>
                            </div>
                            {loadingMethod === 'netbanking' ? (
                                <Loader2 className="w-5 h-5 animate-spin text-accent-cyanText" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-app-bg border border-app-cardBorder flex items-center justify-center text-text-secondary group-hover:text-accent-cyanText group-hover:border-accent-cyanText/30 transition-colors">
                                    →
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
