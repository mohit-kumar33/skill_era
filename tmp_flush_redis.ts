import { Redis } from 'ioredis';
import 'dotenv/config';

async function clearRateLimits() {
    console.log('Connecting to Redis directly...');
    const redis = new Redis(process.env.REDIS_URL as string, { tls: {} });
    await redis.flushall();
    console.log('Redis flushed via flushall!');
    process.exit(0);
}

clearRateLimits().catch(console.error);
