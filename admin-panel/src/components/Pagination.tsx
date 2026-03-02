import type { Pagination } from '@/lib/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    pagination: Pagination;
    onPageChange: (page: number) => void;
}

export default function PaginationControls({ pagination, onPageChange }: PaginationProps) {
    const { page, totalPages, total } = pagination;

    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
            <span className="text-sm text-zinc-500">
                {total} total result{total !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-zinc-400">
                    {page} / {totalPages}
                </span>
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
