/**
 * Notification Service — Central hub for all user-facing notifications.
 *
 * Provides a provider-agnostic interface for sending SMS, email, and push
 * notifications. Integrates with sms.provider.ts and email.provider.ts.
 *
 * Design:
 *   - Fire-and-forget: notifications never block financial flows
 *   - Template-based: structured messages with consistent formatting
 *   - Provider-swappable: abstract interfaces for SMS/email backends
 */

import { logger } from '../../utils/logger.js';
import { sendSms } from './sms.provider.js';
import { sendEmail } from './email.provider.js';
import { prisma } from '../../config/prisma.js';

// ── Types ──────────────────────────────────────────────────────────────

export type NotificationChannel = 'sms' | 'email' | 'both';

interface UserContact {
    mobile: string;
    email: string | null;
}

// ── Internal: Resolve user contact info ──────────────────────────────

async function getUserContact(userId: string): Promise<UserContact | null> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { mobile: true, email: true },
        });
        return user;
    } catch (err) {
        logger.warn({ err, userId }, 'Notification: failed to fetch user contact');
        return null;
    }
}

// ── Notification Dispatcher ─────────────────────────────────────────

async function notify(
    userId: string,
    subject: string,
    smsBody: string,
    emailBody: string,
    channel: NotificationChannel = 'both',
): Promise<void> {
    try {
        const contact = await getUserContact(userId);
        if (!contact) return;

        const promises: Promise<void>[] = [];

        if ((channel === 'sms' || channel === 'both') && contact.mobile) {
            promises.push(sendSms(contact.mobile, smsBody));
        }

        if ((channel === 'email' || channel === 'both') && contact.email) {
            promises.push(sendEmail(contact.email, subject, emailBody));
        }

        await Promise.allSettled(promises);
    } catch (err) {
        // Notifications must NEVER break the calling flow
        logger.warn({ err, userId, subject }, 'Notification: dispatch failed (non-fatal)');
    }
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC NOTIFICATION METHODS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Deposit confirmed — notify user of successful credit.
 */
export async function notifyDepositConfirmed(
    userId: string,
    amount: string,
    depositId: string,
): Promise<void> {
    const sms = `Skill Era: ₹${amount} deposited successfully. Ref: ${depositId.slice(0, 8)}. Play responsibly.`;
    const email = `
        <h2>Deposit Confirmed ✅</h2>
        <p>Your deposit of <strong>₹${amount}</strong> has been credited to your Skill Era wallet.</p>
        <p><strong>Reference:</strong> ${depositId}</p>
        <p>Play responsibly. If you did not make this deposit, contact support immediately.</p>
    `;

    await notify(userId, 'Deposit Confirmed — Skill Era', sms, email);
    logger.info({ userId, amount, depositId }, 'Notification: deposit confirmation sent');
}

/**
 * Withdrawal requested — notify user of pending withdrawal.
 */
export async function notifyWithdrawalRequested(
    userId: string,
    amount: string,
    netAmount: string,
    tdsAmount: string,
    withdrawalId: string,
): Promise<void> {
    const tdsNote = parseFloat(tdsAmount) > 0 ? ` (TDS: ₹${tdsAmount}, Net: ₹${netAmount})` : '';
    const sms = `Skill Era: Withdrawal of ₹${amount}${tdsNote} requested. Ref: ${withdrawalId.slice(0, 8)}. Under review.`;
    const email = `
        <h2>Withdrawal Requested 📤</h2>
        <p>Your withdrawal request has been submitted for review.</p>
        <table style="border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:4px 12px;font-weight:bold;">Amount</td><td style="padding:4px 12px;">₹${amount}</td></tr>
            ${parseFloat(tdsAmount) > 0 ? `<tr><td style="padding:4px 12px;font-weight:bold;">TDS Deducted</td><td style="padding:4px 12px;">₹${tdsAmount}</td></tr>` : ''}
            ${parseFloat(tdsAmount) > 0 ? `<tr><td style="padding:4px 12px;font-weight:bold;">Net Payout</td><td style="padding:4px 12px;">₹${netAmount}</td></tr>` : ''}
            <tr><td style="padding:4px 12px;font-weight:bold;">Reference</td><td style="padding:4px 12px;">${withdrawalId}</td></tr>
            <tr><td style="padding:4px 12px;font-weight:bold;">Status</td><td style="padding:4px 12px;">Under Review</td></tr>
        </table>
        <p>You will be notified once your withdrawal is processed.</p>
    `;

    await notify(userId, 'Withdrawal Requested — Skill Era', sms, email);
    logger.info({ userId, amount, withdrawalId }, 'Notification: withdrawal request sent');
}

/**
 * Withdrawal approved — notify user that admin approved their withdrawal.
 */
export async function notifyWithdrawalApproved(
    userId: string,
    amount: string,
    withdrawalId: string,
): Promise<void> {
    const sms = `Skill Era: Your withdrawal of ₹${amount} has been approved. Payout processing. Ref: ${withdrawalId.slice(0, 8)}.`;
    const email = `
        <h2>Withdrawal Approved ✅</h2>
        <p>Your withdrawal of <strong>₹${amount}</strong> has been approved and is being processed for payout.</p>
        <p><strong>Reference:</strong> ${withdrawalId}</p>
        <p>You will receive the funds in your registered bank account shortly.</p>
    `;

    await notify(userId, 'Withdrawal Approved — Skill Era', sms, email);
    logger.info({ userId, amount, withdrawalId }, 'Notification: withdrawal approval sent');
}

/**
 * Withdrawal rejected — notify user of rejection.
 */
export async function notifyWithdrawalRejected(
    userId: string,
    amount: string,
    withdrawalId: string,
    reason?: string,
): Promise<void> {
    const reasonText = reason ? ` Reason: ${reason}` : '';
    const sms = `Skill Era: Your withdrawal of ₹${amount} was not approved.${reasonText} Ref: ${withdrawalId.slice(0, 8)}.`;
    const email = `
        <h2>Withdrawal Not Approved ❌</h2>
        <p>Your withdrawal of <strong>₹${amount}</strong> was not approved.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p><strong>Reference:</strong> ${withdrawalId}</p>
        <p>The amount has been returned to your wallet balance. Contact support if you have questions.</p>
    `;

    await notify(userId, 'Withdrawal Update — Skill Era', sms, email);
    logger.info({ userId, amount, withdrawalId }, 'Notification: withdrawal rejection sent');
}

/**
 * Payout completed — notify user that funds have been sent.
 */
export async function notifyPayoutCompleted(
    userId: string,
    amount: string,
    withdrawalId: string,
): Promise<void> {
    const sms = `Skill Era: ₹${amount} has been sent to your bank account. Ref: ${withdrawalId.slice(0, 8)}.`;
    const email = `
        <h2>Payout Completed 💰</h2>
        <p><strong>₹${amount}</strong> has been transferred to your registered bank account.</p>
        <p><strong>Reference:</strong> ${withdrawalId}</p>
        <p>Please allow 1-2 business days for the amount to reflect in your account.</p>
    `;

    await notify(userId, 'Payout Completed — Skill Era', sms, email);
    logger.info({ userId, amount, withdrawalId }, 'Notification: payout completion sent');
}

/**
 * Tournament reminder/alert — notify user of tournament events.
 */
export async function notifyTournamentAlert(
    userId: string,
    tournamentName: string,
    message: string,
): Promise<void> {
    const sms = `Skill Era: ${tournamentName} — ${message}`;
    const email = `
        <h2>Tournament Update 🏆</h2>
        <p><strong>${tournamentName}</strong></p>
        <p>${message}</p>
    `;

    await notify(userId, `Tournament Update — ${tournamentName}`, sms, email);
}

/**
 * KYC status update — notify user of KYC verification result.
 */
export async function notifyKycStatusUpdate(
    userId: string,
    status: 'verified' | 'rejected',
    reason?: string,
): Promise<void> {
    const approved = status === 'verified';
    const sms = approved
        ? 'Skill Era: Your KYC verification is complete. You can now request withdrawals.'
        : `Skill Era: Your KYC was not approved.${reason ? ` Reason: ${reason}` : ''} Please resubmit.`;

    const email = approved
        ? `<h2>KYC Verified ✅</h2><p>Your identity verification is complete. You can now request withdrawals from your Skill Era wallet.</p>`
        : `<h2>KYC Not Approved ❌</h2><p>Your KYC submission was not approved.</p>${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}<p>Please update your documents and resubmit.</p>`;

    await notify(userId, `KYC ${approved ? 'Verified' : 'Update'} — Skill Era`, sms, email);
    logger.info({ userId, status }, 'Notification: KYC status update sent');
}
