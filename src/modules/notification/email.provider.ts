/**
 * Email Provider — Adapter for sending transactional emails.
 *
 * Supports multiple backends via environment config:
 *   - SendGrid (primary)
 *   - AWS SES (fallback)
 *   - Console (development — logs to stdout)
 *
 * All sends are fire-and-forget with structured logging.
 */

import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

/**
 * Send a transactional email.
 * Non-blocking — errors are logged but never thrown.
 */
export async function sendEmail(
    to: string,
    subject: string,
    htmlBody: string,
): Promise<void> {
    // Development mode: log to console
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
        logger.info(
            { to, subject, bodyLength: htmlBody.length },
            'Email (dev): would send',
        );
        return;
    }

    const provider = env.EMAIL_PROVIDER ?? 'console';

    try {
        switch (provider) {
            case 'sendgrid':
                await sendViaSendGrid(to, subject, htmlBody);
                break;
            case 'ses':
                await sendViaSES(to, subject, htmlBody);
                break;
            case 'nodemailer':
                await sendViaNodemailer(to, subject, htmlBody);
                break;
            default:
                logger.info({ to, subject }, 'Email (console): no provider configured');
                return;
        }

        logger.info({ to, subject, provider }, 'Email sent successfully');
    } catch (err) {
        logger.error({ err, to, subject, provider }, 'Email send failed');
    }
}

// ── SendGrid Provider ─────────────────────────────────────────────────

async function sendViaSendGrid(
    to: string,
    subject: string,
    htmlBody: string,
): Promise<void> {
    const apiKey = env.EMAIL_API_KEY;
    const fromEmail = env.EMAIL_FROM_ADDRESS ?? 'noreply@apexarena.in';

    if (!apiKey) {
        logger.warn('SendGrid: EMAIL_API_KEY not configured');
        return;
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: fromEmail, name: 'Skill Era' },
            subject,
            content: [
                { type: 'text/html', value: wrapInTemplate(subject, htmlBody) },
            ],
        }),
        signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`SendGrid error: ${response.status} — ${body}`);
    }
}

// ── AWS SES Provider ──────────────────────────────────────────────────

async function sendViaSES(
    to: string,
    subject: string,
    htmlBody: string,
): Promise<void> {
    const apiKey = env.EMAIL_API_KEY;
    const region = env.EMAIL_SES_REGION ?? 'ap-south-1';
    const fromEmail = env.EMAIL_FROM_ADDRESS ?? 'noreply@apexarena.in';

    if (!apiKey) {
        logger.warn('SES: EMAIL_API_KEY not configured');
        return;
    }

    // SES v2 API — simple email send
    const url = `https://email.${region}.amazonaws.com/v2/email/outbound-emails`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            FromEmailAddress: fromEmail,
            Destination: { ToAddresses: [to] },
            Content: {
                Simple: {
                    Subject: { Data: subject },
                    Body: { Html: { Data: wrapInTemplate(subject, htmlBody) } },
                },
            },
        }),
        signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`SES error: ${response.status} — ${body}`);
    }
}

// ── Nodemailer / SMTP Provider ────────────────────────────────────────

async function sendViaNodemailer(
    to: string,
    subject: string,
    htmlBody: string,
): Promise<void> {
    const host = env.EMAIL_SMTP_HOST;
    const port = env.EMAIL_SMTP_PORT;
    const user = env.EMAIL_SMTP_USER;
    const pass = env.EMAIL_SMTP_PASS;
    const fromEmail = env.EMAIL_FROM_ADDRESS ?? 'noreply@apexarena.in';

    if (!host || !port || !user || !pass) {
        logger.warn('Nodemailer: SMTP credentials (HOST/PORT/USER/PASS) not fully configured');
        return;
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // True for 465, false for 587/25
        auth: {
            user,
            pass,
        },
    });

    await transporter.sendMail({
        from: `"Skill Era" <${fromEmail}>`,
        to,
        subject,
        html: wrapInTemplate(subject, htmlBody),
    });
}

// ── Email Template Wrapper ────────────────────────────────────────────

function wrapInTemplate(title: string, bodyHtml: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f7;padding:32px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="580" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px;text-align:center;">
                            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">🏆 Skill Era</h1>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding:32px;">
                            ${bodyHtml}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding:16px 32px;background:#f9fafb;text-align:center;font-size:12px;color:#6b7280;">
                            <p style="margin:4px 0;">This is an automated message from Skill Era.</p>
                            <p style="margin:4px 0;">If you did not perform this action, contact support immediately.</p>
                            <p style="margin:4px 0;">© ${new Date().getFullYear()} Skill Era. Play responsibly.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}
