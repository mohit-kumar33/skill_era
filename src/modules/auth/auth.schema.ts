import { z } from 'zod';
import { BLOCKED_STATES, MIN_AGE_YEARS, DISPOSABLE_EMAIL_DOMAINS } from '../../config/constants.js';

export const registerSchema = z.object({
    mobile: z
        .string()
        .min(10)
        .max(15)
        .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid mobile number'),
    email: z.string().email().optional().refine((email) => {
        if (!email) return true;
        const domain = email.split('@')[1];
        if (!domain) return false;
        return !DISPOSABLE_EMAIL_DOMAINS.includes(domain);
    }, { message: 'Disposable email domains are not allowed' }),
    password: z
        .string()
        .min(8)
        .max(128)
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            'Password must contain uppercase, lowercase, and digit',
        ),
    dateOfBirth: z.string().refine(
        (dob) => {
            const birthDate = new Date(dob);
            if (isNaN(birthDate.getTime())) return false;
            const today = new Date();
            const age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            const dayDiff = today.getDate() - birthDate.getDate();
            const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
            return actualAge >= MIN_AGE_YEARS;
        },
        { message: `Must be at least ${MIN_AGE_YEARS} years old` },
    ),
    state: z.string().min(2).max(50).refine(
        (state) => !BLOCKED_STATES.includes(state),
        { message: 'Service not available in your state' },
    ),
    cfTurnstileResponse: z.string().min(1, 'Captcha verification required'),
});

export const loginSchema = z.object({
    identifier: z.string().min(1, 'Email or mobile number is required'),
    password: z.string().min(1),
    cfTurnstileResponse: z.string().min(1, 'Captcha verification required'),
});

export const refreshSchema = z.object({
    refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

export const googleAuthSchema = z.object({
    idToken: z.string().min(1, 'Google ID token is required'),
});

export const sendOtpSchema = z.object({
    identifier: z.string().min(1, 'Email or mobile number is required'),
    cfTurnstileResponse: z.string().min(1, 'Captcha verification required'),
});

export const verifyOtpSchema = z.object({
    preAuthToken: z.string().min(1, 'Pre-auth token is required'),
    otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be a 6-digit number'),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
