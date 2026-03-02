import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default('0.0.0.0'),

    // PostgreSQL
    DATABASE_URL: z.string().url(),
    DB_HOST: z.string().default('db.ixxtmpkpgxqygdtfdxfe.supabase.co'),
    DB_PORT: z.coerce.number().int().default(5432),
    DB_NAME: z.string().default('postgres'),
    DB_USER: z.string().default('postgres'),
    DB_PASSWORD: z.string(),
    DB_POOL_MIN: z.coerce.number().int().default(2),
    DB_POOL_MAX: z.coerce.number().int().default(30),

    // Supabase API
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_KEY: z.string().optional(),

    // Redis
    REDIS_URL: z.string().default('redis://localhost:6379'),

    // JWT
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),

    // Webhook
    PAYMENT_WEBHOOK_SECRET: z.string().min(16),

    // Payout
    PAYOUT_API_URL: z.string().url().optional(),
    PAYOUT_API_KEY: z.string().optional(),

    // Cashfree
    CASHFREE_APP_ID: z.string().optional(),
    CASHFREE_API_KEY: z.string().optional(),
    CASHFREE_API_URL: z.string().url().default('https://sandbox.cashfree.com/pg'),

    // Gateway Reconciliation
    GATEWAY_API_URL: z.string().url().optional(),
    GATEWAY_API_KEY: z.string().optional(),

    // TDS
    TDS_THRESHOLD_INR: z.coerce.number().default(10000),
    TDS_RATE_PERCENT: z.coerce.number().default(30),
    TDS_NO_PAN_RATE_PERCENT: z.coerce.number().default(30),

    // Encryption (AES-256-GCM — 32-byte key, base64 encoded = min 44 chars)
    // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
    ENCRYPTION_KEY: z.string().min(44, 'ENCRYPTION_KEY must be at least 44 chars (32-byte base64)'),

    // CORS — comma-separated allowed origins (e.g. http://localhost:3001,http://localhost:3002)
    CORS_ORIGINS: z.string().default('http://localhost:3001,http://localhost:3002'),

    // Cloudflare Turnstile CAPTCHA Secret
    TURNSTILE_SECRET_KEY: z.string().default('1x0000000000000000000000000000000AA'),

    // Slack alerting (optional — falls back to log if empty)
    SLACK_WEBHOOK_URL: z.string().url().optional(),

    // Backup encryption key (loaded from env, NOT stored with backups)
    BACKUP_ENCRYPTION_KEY: z.string().min(16).optional(),

    // Instance count for DB pool capacity validation
    INSTANCE_COUNT: z.coerce.number().int().positive().default(1),

    // CORS — separate admin and user origins for route-level enforcement
    CORS_ADMIN_ORIGINS: z.string().default('http://localhost:3002'),

    // ── SMS Provider ─────────────────────────────────────
    SMS_PROVIDER: z.enum(['msg91', 'twilio', 'console']).default('console'),
    SMS_API_KEY: z.string().optional(),
    SMS_ACCOUNT_SID: z.string().optional(),      // Twilio Account SID
    SMS_FROM_NUMBER: z.string().optional(),       // Twilio From number
    SMS_TEMPLATE_ID: z.string().optional(),       // MSG91 template ID

    // ── Email Provider ───────────────────────────────────
    EMAIL_PROVIDER: z.enum(['sendgrid', 'ses', 'nodemailer', 'console']).default('console'),
    EMAIL_API_KEY: z.string().optional(),
    EMAIL_FROM_ADDRESS: z.string().email().default('noreply@apexarena.in'),
    EMAIL_SES_REGION: z.string().default('ap-south-1'),
    EMAIL_SMTP_HOST: z.string().optional(),
    EMAIL_SMTP_PORT: z.coerce.number().optional(),
    EMAIL_SMTP_USER: z.string().optional(),
    EMAIL_SMTP_PASS: z.string().optional(),

    // ── KYC Provider ─────────────────────────────────────
    KYC_PROVIDER: z.enum(['digilocker', 'manual']).default('manual'),
    KYC_API_KEY: z.string().optional(),
    KYC_API_URL: z.string().url().optional(),

    // ── Object Storage (S3 / MinIO) ──────────────────────
    STORAGE_ENDPOINT: z.string().optional(),
    STORAGE_BUCKET: z.string().default('skill-era'),
    STORAGE_REGION: z.string().default('ap-south-1'),
    STORAGE_ACCESS_KEY: z.string().optional(),
    STORAGE_SECRET_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
        const formatted = parsed.error.format();
        console.error('❌ Invalid environment variables:', JSON.stringify(formatted, null, 2));
        process.exit(1);
    }

    return parsed.data;
}

export const env = loadEnv();
