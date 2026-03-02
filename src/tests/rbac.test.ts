/**
 * rbac.test.ts
 *
 * Tests for the centralized RBAC role hierarchy helper.
 */

import { describe, it, expect } from 'vitest';
import { hasRole, type UserRole } from '../utils/rbac.js';

describe('rbac.ts — hasRole()', () => {
    // ── user role ──────────────────────────────────────────
    describe('user role', () => {
        it('user has "user" privilege', () => expect(hasRole('user', 'user')).toBe(true));
        it('user does NOT have "admin" privilege', () => expect(hasRole('user', 'admin')).toBe(false));
        it('user does NOT have "finance_admin" privilege', () => expect(hasRole('user', 'finance_admin')).toBe(false));
        it('user does NOT have "super_admin" privilege', () => expect(hasRole('user', 'super_admin')).toBe(false));
    });

    // ── admin role ─────────────────────────────────────────
    describe('admin role', () => {
        it('admin has "user" privilege', () => expect(hasRole('admin', 'user')).toBe(true));
        it('admin has "admin" privilege', () => expect(hasRole('admin', 'admin')).toBe(true));
        it('admin does NOT have "finance_admin" privilege', () => expect(hasRole('admin', 'finance_admin')).toBe(false));
        it('admin does NOT have "super_admin" privilege', () => expect(hasRole('admin', 'super_admin')).toBe(false));
    });

    // ── finance_admin role ─────────────────────────────────
    describe('finance_admin role', () => {
        it('finance_admin has "user" privilege', () => expect(hasRole('finance_admin', 'user')).toBe(true));
        it('finance_admin has "admin" privilege', () => expect(hasRole('finance_admin', 'admin')).toBe(true));
        it('finance_admin has "finance_admin" privilege', () => expect(hasRole('finance_admin', 'finance_admin')).toBe(true));
        it('finance_admin does NOT have "super_admin" privilege', () => expect(hasRole('finance_admin', 'super_admin')).toBe(false));
    });

    // ── super_admin role ───────────────────────────────────
    describe('super_admin role', () => {
        it('super_admin has "user" privilege', () => expect(hasRole('super_admin', 'user')).toBe(true));
        it('super_admin has "admin" privilege', () => expect(hasRole('super_admin', 'admin')).toBe(true));
        it('super_admin has "finance_admin" privilege', () => expect(hasRole('super_admin', 'finance_admin')).toBe(true));
        it('super_admin has "super_admin" privilege', () => expect(hasRole('super_admin', 'super_admin')).toBe(true));
    });

    // ── unknown role ───────────────────────────────────────
    describe('unknown role', () => {
        it('unknown role has no privilege', () => {
            expect(hasRole('hacker' as UserRole, 'user')).toBe(false);
            expect(hasRole('hacker' as UserRole, 'admin')).toBe(false);
        });
    });

    // ── Role access matrix ─────────────────────────────────
    describe('admin route access matrix', () => {
        const adminRouteRoles: UserRole[] = ['admin', 'finance_admin', 'super_admin'];

        it('all 3 can access admin routes', () => {
            for (const role of adminRouteRoles) {
                expect(hasRole(role, 'admin')).toBe(true);
            }
        });

        it('user CANNOT access admin routes', () => {
            expect(hasRole('user', 'admin')).toBe(false);
        });
    });

    describe('finance route access matrix', () => {
        it('finance_admin can access finance routes', () => {
            expect(hasRole('finance_admin', 'finance_admin')).toBe(true);
        });
        it('super_admin can access finance routes', () => {
            expect(hasRole('super_admin', 'finance_admin')).toBe(true);
        });
        it('admin CANNOT access finance routes', () => {
            expect(hasRole('admin', 'finance_admin')).toBe(false);
        });
        it('user CANNOT access finance routes', () => {
            expect(hasRole('user', 'finance_admin')).toBe(false);
        });
    });
});
