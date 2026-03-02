'use client';

import ReactQueryProvider from '@/providers/ReactQueryProvider';
import { ToastProvider } from '@/components/ToastProvider';
import GlobalErrorHandler from '@/components/GlobalErrorHandler';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ReactQueryProvider>
            <ToastProvider>
                <GlobalErrorHandler />
                {children}
            </ToastProvider>
        </ReactQueryProvider>
    );
}
