/**
 * SMS Provider — Gateway adapter for sending SMS messages.
 *
 * Supports multiple providers via environment config:
 *   - MSG91 (India-optimized, DLT compliant)
 *   - Twilio (international fallback)
 *   - Mock/Console (development)
 *
 * All sends are fire-and-forget with structured logging.
 */

import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

// ── Rate limit: max 3 SMS per phone per 5 minutes ─────────────────────
const smsRateMap = new Map<string, number[]>();
const SMS_RATE_WINDOW_MS = 5 * 60 * 1000;
const SMS_RATE_MAX = 3;

function isRateLimited(phone: string): boolean {
    const now = Date.now();
    const timestamps = smsRateMap.get(phone) ?? [];
    const recent = timestamps.filter(t => now - t < SMS_RATE_WINDOW_MS);

    if (recent.length >= SMS_RATE_MAX) {
        logger.warn({ phone: phone.slice(-4) }, 'SMS rate limit exceeded');
        return true;
    }

    recent.push(now);
    smsRateMap.set(phone, recent);

    // Memory hygiene
    if (smsRateMap.size > 10_000) {
        const keys = [...smsRateMap.keys()];
        for (let i = 0; i < keys.length / 2; i++) {
            smsRateMap.delete(keys[i]!);
        }
    }

    return false;
}

/**
 * Send an SMS message to a phone number.
 * Non-blocking — errors are logged but never thrown.
 */
export async function sendSms(phone: string, message: string): Promise<void> {
    // Development mode: log to console
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
        logger.info({ phone: phone.slice(-4), messageLength: message.length }, 'SMS (dev): would send');
        return;
    }

    if (isRateLimited(phone)) return;

    const provider = env.SMS_PROVIDER ?? 'console';

    try {
        switch (provider) {
            case 'msg91':
                await sendViaMSG91(phone, message);
                break;
            case 'twilio':
                await sendViaTwilio(phone, message);
                break;
            default:
                logger.info({ phone: phone.slice(-4), message }, 'SMS (console): no provider configured');
                return;
        }

        logger.info({ phone: phone.slice(-4), provider }, 'SMS sent successfully');
    } catch (err) {
        logger.error({ err, phone: phone.slice(-4), provider }, 'SMS send failed');
    }
}

// ── MSG91 Provider ────────────────────────────────────────────────────

async function sendViaMSG91(phone: string, message: string): Promise<void> {
    const authKey = env.SMS_API_KEY;
    if (!authKey) {
        logger.warn('MSG91: SMS_API_KEY not configured');
        return;
    }

    const response = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'authkey': authKey,
        },
        body: JSON.stringify({
            template_id: env.SMS_TEMPLATE_ID ?? '',
            short_url: '0',
            recipients: [{ mobiles: phone, message }],
        }),
        signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`MSG91 error: ${response.status} — ${body}`);
    }
}

// ── Twilio Provider ───────────────────────────────────────────────────

async function sendViaTwilio(phone: string, message: string): Promise<void> {
    const accountSid = env.SMS_ACCOUNT_SID;
    const authToken = env.SMS_API_KEY;
    const fromNumber = env.SMS_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        logger.warn('Twilio: SMS_ACCOUNT_SID, SMS_API_KEY, or SMS_FROM_NUMBER not configured');
        return;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
            To: phone,
            From: fromNumber,
            Body: message,
        }),
        signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Twilio error: ${response.status} — ${body}`);
    }
}
