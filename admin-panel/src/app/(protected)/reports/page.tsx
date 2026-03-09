'use client';

import { useState } from 'react';
import api from '@/lib/api';
import {
    FileText,
    Download,
    AlertCircle,
    ShieldCheck,
    Loader2
} from 'lucide-react';
import { format, subDays } from 'date-fns';

export default function ReportsPage() {
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [downloading, setDownloading] = useState<string | null>(null);

    const handleDownload = async (type: 'tds' | 'aml' | 'audit') => {
        try {
            setDownloading(type);

            // Note: In a real app we would use blob response type, but keeping it simple assuming JSON strings
            // or adjusting to the exact api signature
            const response = await api.get(`/admin/reports/${type}`, {
                params: {
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString(),
                    limit: 500
                }
            });

            // Convert to CSV string hack if it returns json
            const data = response.data?.data || [];
            if (!data.length) {
                alert(`No records found for ${type.toUpperCase()} in this date range.`);
                return;
            }

            const header = Object.keys(data[0]).join(',');
            const rows = data.map((obj: any) => Object.values(obj).join(',')).join('\n');
            const csv = `${header}\n${rows}`;

            // Trigger download
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}-report-${startDate}-to-${endDate}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            alert(`Failed to download ${type.toUpperCase()}: ` + (error.response?.data?.message || error.message));
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Compliance & Reports</h1>
            </div>

            {/* Date Range Selector */}
            <div className="bg-app-card border border-app-cardBorder rounded-2xl p-6 mb-8 flex flex-col md:flex-row gap-6 items-end">
                <div className="flex-1 w-full space-y-2">
                    <label className="text-sm font-medium text-text-secondary">Start Date</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-[#111318] text-white border border-zinc-800 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>
                <div className="flex-1 w-full space-y-2">
                    <label className="text-sm font-medium text-text-secondary">End Date</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-[#111318] text-white border border-zinc-800 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* TDS Report */}
                <div className="bg-app-card border border-app-cardBorder rounded-2xl p-6 text-center space-y-4 shadow-lg hover:border-accent-goldText/50 transition-colors relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent-goldBg/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <FileText className="w-12 h-12 text-accent-goldText mx-auto relative z-10" />
                    <h3 className="font-bold text-lg text-white relative z-10">TDS Certificate Data</h3>
                    <p className="text-sm text-text-secondary h-12 relative z-10">Export tax deduction computations for users whose net winnings exceeded ₹10,000.</p>
                    <button
                        onClick={() => handleDownload('tds')}
                        disabled={downloading !== null}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-zinc-700 text-white rounded-xl hover:bg-zinc-800 transition-colors relative z-10 disabled:opacity-50"
                    >
                        {downloading === 'tds' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {downloading === 'tds' ? 'Generating...' : 'Export CSV'}
                    </button>
                </div>

                {/* AML Report */}
                <div className="bg-app-card border border-app-cardBorder rounded-2xl p-6 text-center space-y-4 shadow-lg hover:border-red-500/50 transition-colors relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto relative z-10" />
                    <h3 className="font-bold text-lg text-white relative z-10">AML & Fraud Flags</h3>
                    <p className="text-sm text-text-secondary h-12 relative z-10">Export structured indicators of high-velocity money movement and suspicious transactions.</p>
                    <button
                        onClick={() => handleDownload('aml')}
                        disabled={downloading !== null}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-zinc-700 text-white rounded-xl hover:bg-zinc-800 transition-colors relative z-10 disabled:opacity-50"
                    >
                        {downloading === 'aml' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {downloading === 'aml' ? 'Generating...' : 'Export CSV'}
                    </button>
                </div>

                {/* Audit Log */}
                <div className="bg-app-card border border-app-cardBorder rounded-2xl p-6 text-center space-y-4 shadow-lg hover:border-emerald-500/50 transition-colors relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto relative z-10" />
                    <h3 className="font-bold text-lg text-white relative z-10">Finance Audit Log</h3>
                    <p className="text-sm text-text-secondary h-12 relative z-10">Export immutable system logs denoting which admin performed what financial action.</p>
                    <button
                        onClick={() => handleDownload('audit')}
                        disabled={downloading !== null}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 border border-zinc-700 text-white rounded-xl hover:bg-zinc-800 transition-colors relative z-10 disabled:opacity-50"
                    >
                        {downloading === 'audit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {downloading === 'audit' ? 'Generating...' : 'Export CSV'}
                    </button>
                </div>

            </div>
        </div>
    );
}
