import { AlertTriangle } from 'lucide-react';
import type { AxiosError } from 'axios';

interface ErrorAlertProps {
    error: Error | AxiosError | null;
    title?: string;
}

export default function ErrorAlert({ error, title = 'Something went wrong' }: ErrorAlertProps) {
    if (!error) return null;

    const message =
        (error as AxiosError<{ message?: string }>).response?.data?.message ??
        error.message ??
        'An unexpected error occurred';

    return (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div>
                    <p className="text-sm font-medium text-red-400">{title}</p>
                    <p className="mt-1 text-sm text-red-300/80">{message}</p>
                </div>
            </div>
        </div>
    );
}
