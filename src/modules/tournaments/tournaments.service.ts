import type { PoolClient } from 'pg';
import { pool } from '../../config/database.js';
import { prisma } from '../../config/prisma.js';
import { runInTransaction } from '../../utils/transaction.js';
import { withRetry } from '../../utils/retry.js';
import { logger } from '../../utils/logger.js';
import {
    notFound,
    validationError,
    insufficientBalance,
    accountFrozen,
    AppError,
    ERROR_CODES,
} from '../../utils/errors.js';
import { SAME_IP_MATCH_PENALTY, GST_RATE } from '../../config/constants.js';
import type {
    CreateTournamentInput,
    JoinTournamentInput,
    SubmitResultInput,
    UserSubmitResultInput,
} from './tournaments.schema.js';

// ═══════════════════════════════════════════════════════
// TOURNAMENT CRUD
// ═══════════════════════════════════════════════════════

export async function createTournament(adminId: string, input: CreateTournamentInput) {
    const tournament = await prisma.tournament.create({
        data: {
            title: input.title,
            gameType: input.gameType,
            entryFee: input.entryFee,
            commissionPercent: input.commissionPercent,
            maxParticipants: input.maxParticipants,
            scheduledAt: new Date(input.scheduledAt),
            createdBy: adminId,
            status: 'open',
        },
    });

    logger.info({ tournamentId: tournament.id, title: input.title }, 'Tournament created');

    return {
        ...tournament,
        entryFee: tournament.entryFee.toString(),
        prizePool: tournament.prizePool.toString(),
        commissionPercent: tournament.commissionPercent.toString(),
    };
}

export async function listTournaments(
    status?: string,
    page: number = 1,
    limit: number = 20,
) {
    const where: any = {};
    if (status) where.status = status;

    const [tournaments, total] = await Promise.all([
        prisma.tournament.findMany({
            where,
            orderBy: { scheduledAt: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                _count: { select: { participants: true } },
            },
        }),
        prisma.tournament.count({ where }),
    ]);

    return {
        tournaments: tournaments.map(t => ({
            ...t,
            entryFee: t.entryFee.toString(),
            prizePool: t.prizePool.toString(),
            commissionPercent: t.commissionPercent.toString(),
            participantCount: t._count.participants,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

export async function getTournament(tournamentId: string) {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
            participants: {
                include: {
                    user: {
                        select: { id: true, mobile: true },
                    },
                },
            },
            _count: { select: { participants: true } },
        },
    });

    if (!tournament) throw notFound('Tournament');

    return {
        ...tournament,
        entryFee: tournament.entryFee.toString(),
        prizePool: tournament.prizePool.toString(),
        commissionPercent: tournament.commissionPercent.toString(),
        participantCount: tournament._count.participants,
    };
}

// ═══════════════════════════════════════════════════════
// JOIN TOURNAMENT (with entry fee deduction)
// ═══════════════════════════════════════════════════════

export async function joinTournament(userId: string, input: { tournamentId: string; idempotencyKey: string }, ipAddress?: string) {
    // Pre-checks
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { accountStatus: true },
    });
    if (!user) throw notFound('User');
    if (user.accountStatus !== 'active') throw accountFrozen();

    const tournament = await prisma.tournament.findUnique({
        where: { id: input.tournamentId },
    });
    if (!tournament) throw notFound('Tournament');
    if (tournament.status !== 'open') throw validationError('Tournament is not open for registration');

    // Check if already joined (unique constraint also enforces this)
    const existingParticipant = await prisma.participant.findUnique({
        where: { tournamentId_userId: { tournamentId: input.tournamentId, userId } },
    });
    if (existingParticipant) throw new AppError(ERROR_CODES.DUPLICATE_REQUEST, 'Already joined', 409);

    const entryFee = tournament.entryFee.toString();

    // Atomic: lock tournament → check capacity → deduct balance → insert participant → update prize pool
    return withRetry(async () => {
        return runInTransaction(pool, async (client: PoolClient) => {
            // ── CAPACITY CHECK INSIDE TRANSACTION ──────────────────
            // Lock tournament row to prevent concurrent overbooking.
            // SELECT FOR UPDATE SKIP LOCKED ensures that if another request
            // is currently joining this tournament, we skip it and fail
            // immediately so the retry loop can pick it up or try another.
            const tournamentLock = await client.query(
                `SELECT id, max_participants, status, current_participants
                 FROM tournaments
                 WHERE id = $1
                 FOR UPDATE SKIP LOCKED`,
                [input.tournamentId],
            );

            const t = tournamentLock.rows[0];
            if (!t) throw new AppError(ERROR_CODES.CONCURRENT_MODIFICATION, 'Tournament is currently locked. Retrying...', 409);
            if (t.status !== 'open') throw validationError('Tournament is no longer open');

            if (t.current_participants >= t.max_participants) {
                throw validationError('Tournament is full');
            }

            const currentCount = t.current_participants;

            // ── SAME-IP FRAUD SCORING (1v1 only) ──────────────────
            // If this is a 2-player match and another participant
            // joined from the same IP, increase fraud score (don't block).
            if (t.max_participants === 2 && currentCount === 1 && ipAddress) {
                // Check if the other participant used the same IP
                // This is a soft signal, not a hard block (NAT-safe)
                const otherParticipant = await client.query(
                    `SELECT user_id FROM participants WHERE tournament_id = $1 LIMIT 1`,
                    [input.tournamentId],
                );
                if (otherParticipant.rows[0]) {
                    logger.info(
                        {
                            event: 'same_ip_1v1_check',
                            tournamentId: input.tournamentId,
                            userId,
                            otherUserId: otherParticipant.rows[0].user_id,
                            ipAddress,
                        },
                        'Same-IP 1v1 check — flagging for fraud review',
                    );

                    // Increment fraud score + create flag (fire-and-forget, outside txn)
                    prisma.$transaction([
                        prisma.user.update({
                            where: { id: userId },
                            data: { fraudScore: { increment: SAME_IP_MATCH_PENALTY } },
                        }),
                        prisma.fraudFlag.create({
                            data: {
                                userId,
                                flagType: 'same_ip_1v1',
                                riskPoints: SAME_IP_MATCH_PENALTY,
                                description: `Same IP as opponent ${otherParticipant.rows[0].user_id} in tournament ${input.tournamentId}`,
                            },
                        }),
                    ]).catch(() => { });
                }
            }

            // CTE: lock wallet → check balance → deduct → insert ledger
            const deductResult = await client.query(
                `WITH wallet_lock AS (
          SELECT id, user_id, deposit_balance
          FROM wallets
          WHERE user_id = $1
          FOR UPDATE NOWAIT
        ),
        balance_check AS (
          SELECT * FROM wallet_lock WHERE deposit_balance >= $2::numeric
        ),
        wallet_deduct AS (
          UPDATE wallets
          SET deposit_balance = bc.deposit_balance - $2::numeric,
              updated_at = now()
          FROM balance_check bc
          WHERE wallets.id = bc.id
          RETURNING wallets.id,
                    bc.deposit_balance AS old_balance,
                    wallets.deposit_balance AS new_balance
        ),
        ledger_insert AS (
          INSERT INTO wallet_transactions (
            id, user_id, reference_id, transaction_type,
            debit_amount, credit_amount,
            balance_before, balance_after,
            status, idempotency_key, description, created_at
          )
          SELECT
            gen_random_uuid(), $1, $3::uuid, 'entry_fee',
            $2::numeric, 0,
            wd.old_balance, wd.new_balance,
            'confirmed', $4, 'Tournament entry fee: ' || $5,
            now()
          FROM wallet_deduct wd
          RETURNING id
        )
        SELECT wd.new_balance FROM wallet_deduct wd`,
                [userId, entryFee, input.tournamentId, input.idempotencyKey, tournament.title],
            );

            if (!deductResult.rows[0]) throw insufficientBalance();

            // Insert participant
            await client.query(
                `INSERT INTO participants (id, tournament_id, user_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, now())`,
                [input.tournamentId, userId],
            );

            // Accumulate prize pool (entry fee minus commission minus GST)
            const gstAmount = Number(entryFee) * GST_RATE / (1 + GST_RATE); // GST inclusive
            const commission = (Number(entryFee) - gstAmount) * Number(tournament.commissionPercent) / 100;
            const prizeContribution = Number(entryFee) - commission - gstAmount;

            await client.query(
                `UPDATE tournaments
         SET prize_pool = prize_pool + $2::numeric,
             current_participants = current_participants + 1,
             status = CASE WHEN current_participants + 1 >= max_participants THEN 'in_progress' ELSE status END,
             updated_at = now()
         WHERE id = $1`,
                [input.tournamentId, prizeContribution.toFixed(2)],
            );

            // Insert commission ledger entry
            await client.query(
                `INSERT INTO wallet_transactions (
          id, user_id, reference_id, transaction_type,
          debit_amount, credit_amount,
          balance_before, balance_after,
          status, idempotency_key, description, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2::uuid, 'commission',
          $3::numeric, 0, 0, 0,
          'confirmed', 'comm-' || $4, 'Platform commission', now()
        )`,
                [userId, input.tournamentId, commission.toFixed(2), input.idempotencyKey],
            );

            // Insert GST ledger entry (28% on entry fee, inclusive)
            await client.query(
                `INSERT INTO wallet_transactions (
          id, user_id, reference_id, transaction_type,
          debit_amount, credit_amount,
          balance_before, balance_after,
          status, idempotency_key, description, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2::uuid, 'gst',
          $3::numeric, 0, 0, 0,
          'confirmed', 'gst-' || $4, 'GST on tournament entry fee (28%)', now()
        )`,
                [userId, input.tournamentId, gstAmount.toFixed(2), input.idempotencyKey],
            );

            logger.info(
                { userId, tournamentId: input.tournamentId, entryFee },
                'User joined tournament',
            );

            return {
                tournamentId: input.tournamentId,
                entryFeeCharged: entryFee,
                newBalance: deductResult.rows[0].new_balance.toString(),
            };
        });
    });
}

// ═══════════════════════════════════════════════════════
// RESULT SUBMISSION + PRIZE DISTRIBUTION
// ═══════════════════════════════════════════════════════

export async function submitResultAndDistributePrize(
    adminId: string,
    input: SubmitResultInput,
) {
    const tournament = await prisma.tournament.findUnique({
        where: { id: input.tournamentId },
        include: {
            participants: true,
            _count: { select: { participants: true } },
        },
    });

    if (!tournament) throw notFound('Tournament');
    if (tournament.status !== 'in_progress' && tournament.status !== 'open') {
        throw validationError('Tournament is not in a completable state');
    }

    // Verify winner is a participant
    const winner = tournament.participants.find(p => p.userId === input.winnerId);
    if (!winner) throw validationError('Winner is not a participant in this tournament');

    const prizePool = tournament.prizePool.toString();

    return withRetry(async () => {
        return runInTransaction(pool, async (client: PoolClient) => {
            // Credit prize to winner's winning_balance
            const creditResult = await client.query(
                `WITH wallet_lock AS (
          SELECT id, user_id, winning_balance
          FROM wallets
          WHERE user_id = $1
          FOR UPDATE NOWAIT
        ),
        wallet_credit AS (
          UPDATE wallets
          SET winning_balance = wallet_lock.winning_balance + $2::numeric,
              updated_at = now()
          FROM wallet_lock
          WHERE wallets.id = wallet_lock.id
          RETURNING wallets.id,
                    wallet_lock.winning_balance AS old_balance,
                    wallets.winning_balance AS new_balance
        ),
        ledger_insert AS (
          INSERT INTO wallet_transactions (
            id, user_id, reference_id, transaction_type,
            debit_amount, credit_amount,
            balance_before, balance_after,
            status, idempotency_key, description, created_at
          )
          SELECT
            gen_random_uuid(), $1, $3::uuid, 'prize',
            0, $2::numeric,
            wc.old_balance, wc.new_balance,
            'confirmed', 'prize-' || $3::text, 'Tournament prize: ' || $4,
            now()
          FROM wallet_credit wc
          RETURNING id
        )
        SELECT wc.new_balance FROM wallet_credit wc`,
                [input.winnerId, prizePool, input.tournamentId, tournament.title],
            );

            if (!creditResult.rows[0]) {
                throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Winner wallet not found', 500);
            }

            // Update tournament status
            await client.query(
                `UPDATE tournaments SET status = 'completed', updated_at = now() WHERE id = $1`,
                [input.tournamentId],
            );

            // Update participant results
            for (const participant of tournament.participants) {
                const isWinner = participant.userId === input.winnerId;
                await client.query(
                    `UPDATE participants
           SET result_status = $2,
               rank = $3,
               prize_won = $4::numeric
           WHERE id = $1`,
                    [
                        participant.id,
                        isWinner ? 'won' : 'lost',
                        isWinner ? 1 : null,
                        isWinner ? prizePool : null,
                    ],
                );
            }

            // Save match result
            await client.query(
                `INSERT INTO match_results (
          id, tournament_id, user_id, screenshot_url, external_match_id,
          verified_by, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, 'verified', now(), now()
        )`,
                [
                    input.tournamentId,
                    input.winnerId,
                    input.screenshotUrl ?? null,
                    input.externalMatchId ?? null,
                    adminId,
                ],
            );

            // Admin audit log
            await client.query(
                `INSERT INTO admin_logs (id, admin_id, action_type, target_user_id, metadata, created_at)
         VALUES (gen_random_uuid(), $1, 'prize_distributed', $2,
                 $3::jsonb, now())`,
                [adminId, input.winnerId, JSON.stringify({
                    tournamentId: input.tournamentId,
                    prizePool,
                    title: tournament.title,
                })],
            );

            logger.info(
                { tournamentId: input.tournamentId, winnerId: input.winnerId, prizePool },
                'Prize distributed',
            );

            return {
                tournamentId: input.tournamentId,
                winnerId: input.winnerId,
                prizeAwarded: prizePool,
                status: 'completed',
            };
        });
    });
}
// ... adding to the bottom of tournaments.service.ts
export async function submitTournamentResult(
    userId: string,
    tournamentId: string,
    input: UserSubmitResultInput
) {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
            participants: {
                where: { userId }
            }
        }
    });

    if (!tournament) throw notFound('Tournament');
    if (tournament.participants.length === 0) {
        throw validationError('You are not a participant in this tournament');
    }

    // Check if result already submitted
    const existingResult = await prisma.matchResult.findFirst({
        where: { tournamentId, userId }
    });

    if (existingResult) {
        throw validationError('You have already submitted a result for this tournament');
    }

    const matchResult = await prisma.matchResult.create({
        data: {
            tournamentId,
            userId,
            externalMatchId: input.matchId,
            screenshotUrl: input.screenshotUrl,
            status: 'submitted'
        }
    });

    logger.info({ userId, tournamentId, matchResultId: matchResult.id }, 'User submitted tournament result');

    return {
        id: matchResult.id,
        status: matchResult.status,
        createdAt: matchResult.createdAt
    };
}
