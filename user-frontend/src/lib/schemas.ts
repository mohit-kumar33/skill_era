import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().min(1, 'Email or Mobile is required'),
    password: z.string().min(1, 'Password is required'),
    cfTurnstileResponse: z.string().min(1, 'Captcha verification required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
    .object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        email: z.string().email('Invalid email address').optional(),
        mobile: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid mobile number'),
        dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), {
            message: 'Valid date of birth is required',
        }),
        state: z.string().min(2, 'State is required'),
        password: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
            .regex(/[0-9]/, 'Password must contain at least one number')
            .regex(/[\W_]/, 'Password must contain at least one special character'),
        confirmPassword: z.string(),
        cfTurnstileResponse: z.string().min(1, 'Captcha verification required'),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'], // path of error
    });

export type RegisterFormData = z.infer<typeof registerSchema>;
