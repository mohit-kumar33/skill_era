import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { updateProfileSchema } from './users.schema.js';
import { getUserProfile, updateUserProfile } from './users.service.js';
import { successResponse, validationError, unauthorized } from '../../utils/errors.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
    // All user routes require authentication
    app.addHook('onRequest', authenticate);

    // ── GET /me ───────────────────────────────────────────
    app.get('/me', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();
        const profile = await getUserProfile(request.currentUser.userId);
        return reply.send(successResponse(profile));
    });

    // ── PATCH /profile ────────────────────────────────────
    app.patch('/profile', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const parsed = updateProfileSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const profile = await updateUserProfile(request.currentUser.userId, parsed.data);
        return reply.send(successResponse(profile, 'Profile updated'));
    });

    // ── PUT /me/mobile ────────────────────────────────────
    // Only allows setting the mobile number if it is currently undefined (e.g., Google OAuth signups)
    app.put('/me/mobile', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        // Import schema dynamically if not at top to avoid refactoring whole file here, but we can assume it's imported via Instruction
        const { mobileSchema } = await import('./users.schema.js');
        const { updateMobileNumber } = await import('./users.service.js');

        const parsed = mobileSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        try {
            const profile = await updateMobileNumber(request.currentUser.userId, parsed.data.mobile);
            return reply.send(successResponse(profile, 'Mobile number registered successfully'));
        } catch (error: any) {
            if (error.message.includes('already registered')) {
                throw validationError(error.message);
            }
            throw error;
        }
    });
}
