import { Loader2 } from 'lucide-react';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeMap = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
};

export default function LoadingSpinner({ size = 'md', className = '' }: SpinnerProps) {
    return (
        <div className={`flex items-center justify-center ${className}`}>
            <Loader2 className={`animate-spin text-indigo-400 ${sizeMap[size]}`} />
        </div>
    );
}

export function PageLoader() {
    return (
        <div className="flex h-64 items-center justify-center">
            <LoadingSpinner size="lg" />
        </div>
    );
}
