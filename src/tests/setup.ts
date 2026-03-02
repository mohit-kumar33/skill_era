/**
 * Vitest Setup File — imported by each test worker BEFORE any test modules.
 *
 * Sets required environment variables so env.ts Zod validation passes
 * and does NOT call process.exit(1) during unit test runs.
 *
 * Note: This does NOT connect to a real database — all db pool and Prisma
 * calls are mocked via vi.mock() in individual test files.
 */

// Side-effect: executes immediately when this module is imported
process.env['DATABASE_URL'] = 'postgresql://mock:mock@localhost:5432/mockdb';
process.env['DB_USER'] = 'mock';
process.env['DB_PASSWORD'] = 'mock';
process.env['DB_NAME'] = 'mockdb';
process.env['DB_HOST'] = 'localhost';
process.env['DB_PORT'] = '5432';
process.env['JWT_ACCESS_SECRET'] = 'test-access-secret-32chars-minimum!!';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-32chars-minimum!';
process.env['JWT_ACCESS_EXPIRY'] = '15m';
process.env['JWT_REFRESH_EXPIRY'] = '7d';
process.env['PAYMENT_WEBHOOK_SECRET'] = 'test-webhook-secret-16min';
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3000';
process.env['REDIS_URL'] = 'redis://localhost:6379';
// AES-256-GCM test key — exactly 32 bytes base64 (never use in production)
// Verified: node -e "console.log(Buffer.from('').length)" → 32
process.env['ENCRYPTION_KEY'] = 'Q4rDPPT9lHIu5SseZwpDmwqDec701kYyD27C4LgSmAM=';

