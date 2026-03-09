import { prisma } from '../../config/prisma.js';

/**
 * Fetch aggregated dashboard data for a user.
 * Returns user profile, wallet balances, recent transactions, and active tournaments.
 */
export async function getDashboardData(userId: string) {
    // Run all queries in parallel for performance
    const [user, wallet, recentTransactions, activeTournaments] = await Promise.all([
        // User profile
        prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                mobile: true,
                email: true,
                role: true,
                accountStatus: true,
                kycStatus: true,
                createdAt: true,
            },
        }),

        // Wallet balances
        prisma.wallet.findUnique({
            where: { userId },
            select: {
                id: true,
                depositBalance: true,
                winningBalance: true,
                bonusBalance: true,
            },
        }),

        // Recent 10 transactions
        prisma.walletTransaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                transactionType: true,
                debitAmount: true,
                creditAmount: true,
                balanceBefore: true,
                balanceAfter: true,
                status: true,
                description: true,
                createdAt: true,
            },
        }),

        // Active / upcoming tournaments (open or in_progress) that user can join or has joined
        prisma.tournament.findMany({
            where: {
                status: { in: ['open', 'in_progress'] },
            },
            orderBy: { scheduledAt: 'asc' },
            take: 10,
            select: {
                id: true,
                title: true,
                gameType: true,
                entryFee: true,
                prizePool: true,
                maxParticipants: true,
                status: true,
                scheduledAt: true,
                _count: {
                    select: { participants: true },
                },
                participants: {
                    where: { userId },
                    select: { id: true },
                },
            },
        }),
    ]);

    // Format wallet with computed total
    const depositBalance = wallet ? Number(wallet.depositBalance) : 0;
    const winningBalance = wallet ? Number(wallet.winningBalance) : 0;
    const bonusBalance = wallet ? Number(wallet.bonusBalance) : 0;
    const totalBalance = depositBalance + winningBalance + bonusBalance;

    // Format tournaments to add slotsFilled and isJoined
    const formattedTournaments = activeTournaments.map((t) => ({
        id: t.id,
        title: t.title,
        gameType: t.gameType,
        entryFee: Number(t.entryFee),
        prizePool: Number(t.prizePool),
        maxParticipants: t.maxParticipants,
        slotsFilled: t._count.participants,
        status: t.status,
        scheduledAt: t.scheduledAt,
        isJoined: t.participants.length > 0,
    }));

    // Format transactions
    const formattedTransactions = recentTransactions.map((tx) => ({
        id: tx.id,
        type: tx.transactionType,
        debitAmount: Number(tx.debitAmount),
        creditAmount: Number(tx.creditAmount),
        balanceBefore: Number(tx.balanceBefore),
        balanceAfter: Number(tx.balanceAfter),
        status: tx.status,
        description: tx.description,
        createdAt: tx.createdAt,
    }));

    return {
        user,
        wallet: {
            depositBalance,
            winningBalance,
            bonusBalance,
            totalBalance,
        },
        recentTransactions: formattedTransactions,
        activeTournaments: formattedTournaments,
    };
}
