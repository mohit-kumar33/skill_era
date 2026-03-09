'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import {
    Loader2,
    ShieldCheck,
    AlertCircle,
    Upload,
    ChevronLeft,
    FileText,
    CheckCircle2,
    XCircle,
    Clock
} from 'lucide-react';

interface KycStatusData {
    status: 'pending' | 'submitted' | 'verified' | 'rejected';
    docType?: string;
    docNumber?: string;
    submittedAt?: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const DOC_TYPES = [
    { value: 'aadhaar', label: 'Aadhaar Card' },
    { value: 'pan', label: 'PAN Card' },
    { value: 'voter_id', label: 'Voter ID' },
    { value: 'driving_license', label: 'Driving License' },
    { value: 'passport', label: 'Passport' },
];

async function fetchKycStatus(): Promise<KycStatusData> {
    const res = await api.get('/kyc/status');
    return res.data?.data;
}

export default function KycPage() {
    const queryClient = useQueryClient();

    const [docType, setDocType] = useState('aadhaar');
    const [docNumber, setDocNumber] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const [fileError, setFileError] = useState('');
    const [uploadError, setUploadError] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        data: kycData,
        isLoading,
        error,
        refetch,
    } = useQuery({ queryKey: ['kyc-status'], queryFn: fetchKycStatus });

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
        if (!file) { setFileError('Please select a document image to upload.'); return; }
        if (!docNumber.trim()) { setUploadError('Document Number is required.'); return; }

        try {
            setUploading(true);
            setUploadError('');
            setUploadProgress(10); // starting step 1

            // Step 1: Get presigned URL mapping to the new endpoint
            const presignedRes = await api.post(`/kyc/presigned-url`, {
                fileName: file.name,
                contentType: file.type
            });

            const { url, signedUploadUrl } = presignedRes.data.data;

            // Step 2: Upload directly to S3
            const axios = (await import('axios')).default;
            await axios.put(signedUploadUrl, file, {
                headers: { 'Content-Type': file.type },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 80) / progressEvent.total);
                        setUploadProgress(10 + percent);
                    }
                },
            });

            setUploadProgress(95);

            // Step 3: Inform our backend that upload is complete
            await api.post(`/kyc/submit`, {
                docType,
                docNumber: docNumber.trim(),
                docUrl: url
            });

            setUploadProgress(100);

            // Clean up
            setFile(null);
            setDocNumber('');
            if (fileInputRef.current) fileInputRef.current.value = '';

            // Invalidate to update UI
            refetch();
        } catch (err: any) {
            setUploadError(err.response?.data?.message || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
            setTimeout(() => setUploadProgress(0), 1000);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
            </div>
        );
    }

    if (error || !kycData) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
                <div className="bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 p-6 text-sm text-center max-w-sm w-full">
                    Failed to load profile. Please refresh the page.
                </div>
            </div>
        );
    }

    const { status } = kycData;
    const isPendingOrRejected = status === 'pending' || status === 'rejected';

    return (
        <div className="min-h-screen bg-app-bg pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-app-card/80 backdrop-blur-xl border-b border-app-cardBorder py-4 px-4">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="w-[38px] h-[38px] rounded-xl border border-app-cardBorder flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Profile & KYC</h1>
                        <p className="text-[11px] text-text-secondary uppercase tracking-wider font-semibold">Verification</p>
                    </div>
                </div>
            </header>

            <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-6 mt-2">

                {/* Status Card */}
                <div className="bg-app-card rounded-2xl border border-app-cardBorder p-6 relative overflow-hidden">
                    {/* Background glows based on status */}
                    <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none
                        ${status === 'verified' ? 'bg-emerald-500' : status === 'rejected' ? 'bg-red-500' : status === 'submitted' ? 'bg-amber-500' : 'bg-gray-500'}`} />

                    <div className="flex items-start gap-4 relative z-10">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                            ${status === 'verified' ? 'bg-emerald-500/20 text-emerald-400' :
                                status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                    status === 'submitted' ? 'bg-amber-500/20 text-amber-400' :
                                        'bg-white/10 text-white'}`}>
                            {status === 'verified' ? <CheckCircle2 className="w-6 h-6" /> :
                                status === 'rejected' ? <XCircle className="w-6 h-6" /> :
                                    status === 'submitted' ? <Clock className="w-6 h-6" /> :
                                        <ShieldCheck className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                Current Status
                            </h2>
                            <p className="text-sm text-text-secondary mt-1">
                                {status === 'verified' && "Your identity has been fully verified. You can withdraw funds and access all features."}
                                {status === 'submitted' && "Your documents are currently under review by our team. This usually takes up to 24 hours."}
                                {status === 'rejected' && "Your previous document submission was rejected. Please re-upload clear and valid documents."}
                                {status === 'pending' && "Please upload a valid identity verification document to unlock withdrawals."}
                            </p>

                            <div className="mt-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                                    ${status === 'verified' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                        status === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                            status === 'submitted' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                                'bg-white/10 text-text-primary border border-white/20'}`}>
                                    {status}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Upload Form (only if pending or rejected) */}
                {isPendingOrRejected && (
                    <form onSubmit={handleUpload} className="bg-app-card rounded-2xl border border-app-cardBorder p-6 space-y-6 relative overflow-hidden">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <FileText className="w-5 h-5 text-accent-cyanText" />
                                Submit Documents
                            </h3>
                            <p className="text-sm text-text-secondary">Upload a clear photo of your original document.</p>
                        </div>

                        {uploadError && (
                            <div className="bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl p-3 text-sm flex gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <p>{uploadError}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Document Type</label>
                                <select
                                    value={docType}
                                    onChange={(e) => setDocType(e.target.value)}
                                    disabled={uploading}
                                    className="w-full bg-[#1A1D24] text-white rounded-xl border border-app-cardBorder px-4 py-3 text-sm focus:outline-none focus:border-accent-cyanText transition-colors appearance-none"
                                >
                                    {DOC_TYPES.map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Document Number</label>
                                <input
                                    type="text"
                                    placeholder="Enter exactly as shown on document"
                                    value={docNumber}
                                    onChange={(e) => setDocNumber(e.target.value)}
                                    disabled={uploading}
                                    className="w-full bg-[#1A1D24] text-white rounded-xl border border-app-cardBorder px-4 py-3 text-sm focus:outline-none focus:border-accent-cyanText transition-colors placeholder:text-text-secondary/50"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Document Image</label>
                                <div
                                    className="border-2 border-dashed border-app-cardBorder hover:border-accent-cyanText/50 rounded-xl p-6 text-center transition-colors cursor-pointer group"
                                    onClick={() => !uploading && fileInputRef.current?.click()}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept={ALLOWED_TYPES.join(',')}
                                        className="hidden"
                                        disabled={uploading}
                                    />
                                    <div className="w-12 h-12 rounded-full bg-white/5 mx-auto flex items-center justify-center group-hover:bg-accent-cyanBg/20 transition-colors mb-3">
                                        <Upload className={`w-6 h-6 ${file ? 'text-accent-cyanText' : 'text-text-secondary group-hover:text-accent-cyanText'}`} />
                                    </div>
                                    <span className="text-sm font-semibold text-text-primary block mb-1">
                                        {file ? file.name : "Tap to upload identity proof"}
                                    </span>
                                    <span className="text-xs text-text-secondary block">
                                        {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "JPEG, PNG up to 5MB"}
                                    </span>
                                </div>
                                {fileError && <p className="text-red-400 text-xs mt-2 pl-1">{fileError}</p>}
                            </div>
                        </div>

                        {uploadProgress > 0 && uploadProgress < 100 && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-medium text-text-secondary">
                                    <span>Uploading & Verifying...</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-accent-cyanText transition-all duration-300 ease-out"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={uploading || !file || !docNumber.trim()}
                            className="w-full py-4 rounded-xl font-bold text-white transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-accent-cyanBg active:bg-cyan-700"
                        >
                            {uploading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Processing Secure Upload...
                                </span>
                            ) : (
                                "Submit for Verification"
                            )}
                        </button>
                    </form>
                )}
            </main>
        </div>
    );
}
