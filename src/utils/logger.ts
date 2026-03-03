import pino from 'pino';
import type { TransportTargetOptions } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// ═══════════════════════════════════════════════════════════════════════
// CENTRALIZED LOGGING
// ═══════════════════════════════════════════════════════════════════════
//
// Production: Multi-transport logging
//   1. JSON to stdout (for container/systemd capture → CloudWatch/Datadog)
//   2. Rotating file logs at ./logs/ (fallback for non-containerized deploys)
//   3. Optional: forward to external aggregator via LOG_AGGREGATOR_URL
//
// Development: pino-pretty to stdout
// ═══════════════════════════════════════════════════════════════════════

function buildProductionTransport(): pino.TransportMultiOptions {
    const targets: TransportTargetOptions[] = [
        // 1. JSON to stdout — captured by container runtime (Docker/K8s → CloudWatch/Datadog)
        {
            target: 'pino/file',
            options: { destination: 1 }, // fd 1 = stdout
            level: 'info',
        },
        // 2. Rotating file logs — fallback for bare-metal / VM deploys
        //    Requires: npm install pino-roll
        //    Creates: ./logs/skill-era.log, rotates daily, keeps 14 days
        {
            target: 'pino-roll',
            options: {
                file: './logs/skill-era',
                frequency: 'daily',
                dateFormat: 'yyyy-MM-dd',
                mkdir: true,
                limit: {
                    count: 14,     // Keep 14 days of logs
                },
            },
            level: 'info',
        },
    ];

    // 3. Optional: HTTP log forwarding (Datadog, Loki, Logstash, etc.)
    //    Set LOG_AGGREGATOR_URL=https://http-intake.logs.datadoghq.com/v1/input
    //    Set LOG_AGGREGATOR_TOKEN=<your-api-key>
    const aggregatorUrl = process.env.LOG_AGGREGATOR_URL;
    if (aggregatorUrl) {
        targets.push({
            target: 'pino-http-send',
            options: {
                url: aggregatorUrl,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(process.env.LOG_AGGREGATOR_TOKEN
                        ? { 'DD-API-KEY': process.env.LOG_AGGREGATOR_TOKEN }
                        : {}),
                },
                batchSize: 10,
                interval: 5000,       // Flush every 5 seconds
            },
            level: 'warn',            // Only forward warn+ to aggregator to reduce noise
        });
    }

    return { targets };
}

export const logger = pino({
    level: isProduction ? 'info' : 'debug',
    // Standard fields on every log line
    base: {
        service: 'skill-era-api',
        env: process.env.NODE_ENV,
    },
    // Only apply formatters in development to avoid transport conflicts in production
    ...(isProduction ? {} : {
        formatters: {
            level: (label: string) => ({ level: label }),
        },
    }),
    timestamp: pino.stdTimeFunctions.isoTime,
    // Redact sensitive fields from logs
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-csrf-token"]',
            'password',
            'passwordHash',
            'panNumber',
            'encryptedPan',
            'kycDocNumber',
            'twoFactorSecret',
        ],
        censor: '[REDACTED]',
    },
    transport: isProduction
        ? buildProductionTransport()
        : {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
});

export function createChildLogger(context: Record<string, unknown>) {
    return logger.child(context);
}
