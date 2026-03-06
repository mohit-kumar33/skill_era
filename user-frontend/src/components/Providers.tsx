'use client';

import ReactQueryProvider from '@/providers/ReactQueryProvider';
import { ToastProvider } from '@/components/ToastProvider';
import GlobalErrorHandler from '@/components/GlobalErrorHandler';
import { GoogleOAuthProvider } from '@react-oauth/google';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'dummy'}>
            <ReactQueryProvider>
                <ToastProvider>
                    <GlobalErrorHandler />
                    {children}
                </ToastProvider>
            </ReactQueryProvider>
        </GoogleOAuthProvider>
    );
}
