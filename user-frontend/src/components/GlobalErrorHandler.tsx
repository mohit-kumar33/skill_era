'use client';

import { useEffect } from 'react';
import { useToast } from './ToastProvider';
import { useRouter, usePathname } from 'next/navigation';

export default function GlobalErrorHandler() {
    const { addToast } = useToast();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const handleApiError = (event: Event) => {
            const customEvent = event as CustomEvent<{ type: string; message?: string }>;
            const { type, message } = customEvent.detail;

            switch (type) {
                case 'network':
                    addToast('Network issue. Please retry.', 'error');
                    break;
                case 'unauthorized':
                    addToast('Session expired. Please login again.', 'error');
                    // Avoid loop if already on login
                    if (pathname !== '/login' && pathname !== '/register') {
                        router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
                    }
                    break;
                case 'conflict':
                    addToast('This action was already completed.', 'info');
                    break;
                case 'generic':
                    if (message) addToast(message, 'error');
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('api-error', handleApiError);
        return () => window.removeEventListener('api-error', handleApiError);
    }, [addToast, router, pathname]);

    return null;
}
