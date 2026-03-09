'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { WalletInfo, Transaction } from '@/lib/types';
import { Loader2, AlertCircle, ShieldCheck, ArrowLeft, Building, Smartphone, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

async function fetchWalletInfo(): Promise<WalletInfo> {
    const res = await api.get('/wallet/balance');
    const d = res.data?.data || {};
    return {
        balance: {
            deposit_balance: parseFloat(d.depositBalance || '0'),
            winning_balance: parseFloat(d.winningBalance || '0'),
            bonus_balance: parseFloat(d.bonusBalance || '0'),
            total_balance: parseFloat(d.totalBalance || '0'),
        },
        // We'd ideally fetch real KYC from a profile endpoint, assuming true for demo.
        kyc: { verified: true, status: 'verified' },
    };
}

async function fetchWithdrawals(): Promise<any[]> {
    const res = await api.get('/wallet/withdraw/status?limit=10');
    return res.data?.data?.withdrawals || [];
}

export default function WithdrawPage() {
    const queryClient = useQueryClient();
    const [step, setStep] = useState<'request' | 'otp'>('request');
    const [loading, setLoading] = useState(false);

    // Form State
    const [amount, setAmount] = useState('');
    const [payoutMethod, setPayoutMethod] = useState<'bank_transfer' | 'upi'>('bank_transfer');
    const [bankAccount, setBankAccount] = useState('');
    const [ifsc, setIfsc] = useState('');
    const [upiId, setUpiId] = useState('');

    // Auth State
    const [preAuthToken, setPreAuthToken] = useState('');
    const [otp, setOtp] = useState('');

    // Feedback State
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const { data: walletInfo, isLoading: walletLoading } = useQuery({
        queryKey: ['wallet'],
        queryFn: fetchWalletInfo,
    });

    const { data: withdrawals, isLoading: wxLoading, refetch: refetchWithdrawals } = useQuery({
        queryKey: ['withdrawals'],
        queryFn: fetchWithdrawals,
    });

    const winningBalance = walletInfo?.balance?.winning_balance ?? 0;
    const kycVerified = walletInfo?.kyc?.verified ?? false;
    const cooldownActive = walletInfo?.cooldown_active ?? false;

    const validateRequest = (): boolean => {
        setError('');
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed < 100) {
            setError('Minimum withdrawal is ₹100.');
            return false;
        }
        if (parsed > winningBalance) {
            setError('Amount exceeds withdrawable balance.');
            return false;
        }
        if (payoutMethod === 'bank_transfer') {
            if (!bankAccount || bankAccount.length < 5) {
                setError('Please enter a valid Bank Account Number.');
                return false;
            }
            if (!ifsc || ifsc.length !== 11) {
                setError('Please enter a valid 11-character IFSC Code.');
                return false;
            }
        }
        if (payoutMethod === 'upi') {
            if (!upiId || !upiId.includes('@')) {
                setError('Please enter a valid UPI ID.');
                return false;
            }
        }
        return true;
    };

    const onRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateRequest()) return;

        try {
            setLoading(true);
            setError('');

            // Call the request-otp endpoint
            const res = await api.post('/wallet/withdraw/request-otp', {
                amount: amount, // Only amounts need to be sent technically, but schema accepts it
            });

            setPreAuthToken(res.data?.data?.preAuthToken);
            setSuccess('OTP sent to your registered mobile/email.');
            setStep('otp');

        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to request OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const onSubmitWithdrawal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otp.length !== 6) {
            setError('Please enter a 6-digit OTP.');
            return;
        }

        try {
            setLoading(true);
            setError('');
            setSuccess('');

            await api.post('/wallet/withdraw/request', {
                amount,
                payoutMethod,
                bankAccount: payoutMethod === 'bank_transfer' ? bankAccount : undefined,
                ifsc: payoutMethod === 'bank_transfer' ? ifsc : undefined,
                upiId: payoutMethod === 'upi' ? upiId : undefined,
                preAuthToken,
                otp
            });

            setSuccess('Withdrawal request submitted successfully! It is now under review.');
            setAmount('');
            setBankAccount('');
            setIfsc('');
            setUpiId('');
            setOtp('');
            setStep('request');

            refetchWithdrawals();
            queryClient.invalidateQueries({ queryKey: ['wallet'] });

        } catch (err: any) {
            setError(err.response?.data?.message || 'Withdrawal request failed. Please check your OTP and try again.');
        } finally {
            setLoading(false);
        }
    };

    const renderStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case 'paid': case 'confirmed':
                return <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">Paid</span>;
            case 'rejected': case 'failed':
                return <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-md">Rejected</span>;
            case 'requested': case 'under_review': case 'pending':
                return <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">Pending</span>;
            default:
                return <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold bg-white/5 text-text-secondary border border-white/10 rounded-md">{status}</span>;
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
                    <h1 className="text-xl font-bold">Withdraw Funds</h1>
                    <p className="text-text-secondary text-xs mt-0.5">Withdraw your winnings instantly</p>
                </div>
            </div>

            <div className="px-5 mt-6 space-y-6 max-w-lg mx-auto">
                {/* Winnings Overview */}
                <div className="bg-app-card border border-app-cardBorder rounded-3xl p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <svg viewBox="0 0 24 24" fill="none" className="w-24 h-24 stroke-current">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>

                    <div className="flex justify-between items-center relative z-10">
                        <div>
                            <p className="text-sm text-text-secondary font-medium mb-1">Withdrawable Balance</p>
                            <div className="flex items-baseline gap-1">
                                {walletLoading ? (
                                    <div className="h-8 w-24 bg-white/10 animate-pulse rounded"></div>
                                ) : (
                                    <>
                                        <span className="text-xl text-text-secondary font-bold">₹</span>
                                        <h2 className="text-3xl font-bold text-accent-goldText">{winningBalance.toFixed(2)}</h2>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {!kycVerified && !walletLoading && (
                        <div className="mt-4 flex items-center gap-2 text-xs bg-red-500/10 text-red-400 px-3 py-2 rounded-xl border border-red-500/20">
                            <AlertCircle className="w-4 h-4" />
                            KYC is required to withdraw.
                        </div>
                    )}
                </div>

                {/* Form area */}
                <div className="bg-app-card border border-app-cardBorder rounded-3xl p-6 shadow-sm">
                    {/* Alerts */}
                    {error && (
                        <div className="mb-6 p-3 bg-red-500/10 text-red-400 text-sm rounded-2xl border border-red-500/20 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <p>{error}</p>
                        </div>
                    )}
                    {success && (
                        <div className="mb-6 p-3 bg-emerald-500/10 text-emerald-400 text-sm rounded-2xl border border-emerald-500/20 flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                            <p>{success}</p>
                        </div>
                    )}

                    {step === 'request' ? (
                        <form onSubmit={onRequestOtp} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">Amount to Withdraw</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary text-xl font-bold">₹</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-app-bg border border-app-cardBorder text-xl font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-goldText/50 focus:border-accent-goldText/40 transition-all"
                                        placeholder="0"
                                        min={100}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-3">Transfer Method</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPayoutMethod('bank_transfer')}
                                        className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-medium transition-all ${payoutMethod === 'bank_transfer'
                                                ? 'bg-accent-cyanText/10 border-accent-cyanText/40 text-accent-cyanText'
                                                : 'bg-app-bg border-app-cardBorder text-text-secondary hover:border-white/20'
                                            }`}
                                    >
                                        <Building className="w-4 h-4" /> Bank
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPayoutMethod('upi')}
                                        className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 font-medium transition-all ${payoutMethod === 'upi'
                                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                                                : 'bg-app-bg border-app-cardBorder text-text-secondary hover:border-white/20'
                                            }`}
                                    >
                                        <Smartphone className="w-4 h-4" /> UPI
                                    </button>
                                </div>
                            </div>

                            {payoutMethod === 'bank_transfer' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1">Account Number</label>
                                        <input
                                            type="text"
                                            value={bankAccount}
                                            onChange={(e) => setBankAccount(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-app-bg border border-app-cardBorder text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyanText/50 transition-all font-mono"
                                            placeholder="Enter 9-18 digit account number"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-text-secondary mb-1">IFSC Code</label>
                                        <input
                                            type="text"
                                            value={ifsc}
                                            onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                                            className="w-full px-4 py-3 rounded-xl bg-app-bg border border-app-cardBorder text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-cyanText/50 transition-all font-mono uppercase"
                                            placeholder="e.g. SBIN0001234"
                                            maxLength={11}
                                        />
                                    </div>
                                </div>
                            )}

                            {payoutMethod === 'upi' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                                    <label className="block text-xs font-medium text-text-secondary mb-1">UPI ID</label>
                                    <input
                                        type="text"
                                        value={upiId}
                                        onChange={(e) => setUpiId(e.target.value.toLowerCase())}
                                        className="w-full px-4 py-3 rounded-xl bg-app-bg border border-app-cardBorder text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                        placeholder="username@bank"
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !kycVerified || cooldownActive || winningBalance < 100}
                                className="w-full bg-accent-goldText hover:bg-yellow-400 text-black font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 active:scale-95 mt-6"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Request OTP'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={onSubmitWithdrawal} className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                            <div className="text-center space-y-2 mb-2">
                                <div className="mx-auto w-12 h-12 bg-accent-goldText/10 flex items-center justify-center rounded-full mb-4">
                                    <ShieldCheck className="w-6 h-6 text-accent-goldText" />
                                </div>
                                <h3 className="font-bold text-lg">Verify Withdrawal</h3>
                                <p className="text-sm text-text-secondary">
                                    Enter the 6-digit code sent to your registered contact.
                                </p>
                            </div>

                            <div>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full text-center tracking-[0.5em] text-2xl font-mono px-4 py-4 rounded-xl bg-app-bg border border-app-cardBorder text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-goldText/50 transition-all"
                                    placeholder="------"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setStep('request'); setSuccess(''); setError(''); setOtp(''); }}
                                    className="flex-1 bg-app-bg border border-app-cardBorder hover:bg-white/5 text-text-primary font-bold py-3.5 rounded-xl transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || otp.length !== 6}
                                    className="flex-[2] bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 active:scale-95"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Withdraw'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Recent Withdrawals */}
                <div className="mt-8">
                    <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 px-1">Recent Requests</h2>

                    {wxLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
                        </div>
                    ) : withdrawals && withdrawals.length > 0 ? (
                        <div className="space-y-3">
                            {withdrawals.map((w: any) => (
                                <div key={w.id} className="bg-app-card border border-app-cardBorder rounded-2xl p-4 flex items-center justify-between group hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-app-bg flex items-center justify-center border border-app-cardBorder">
                                            {w.payoutMethod === 'upi' ? (
                                                <Smartphone className="w-4 h-4 text-emerald-400" />
                                            ) : (
                                                <Building className="w-4 h-4 text-accent-cyanText" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">₹{w.amount}</p>
                                            <p className="text-[10px] text-text-secondary mt-0.5">
                                                {new Date(w.createdAt).toLocaleDateString()}
                                                {w.payoutMethod === 'upi' && w.payoutDetails?.upiId ? ` • ${w.payoutDetails.upiId}` : ''}
                                                {w.payoutMethod === 'bank_transfer' && w.payoutDetails?.bankAccount ? ` • XX${w.payoutDetails.bankAccount.slice(-4)}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    {renderStatusBadge(w.status)}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-app-card rounded-2xl border border-app-cardBorder border-dashed">
                            <p className="text-text-secondary text-sm">No recent withdrawals found.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
