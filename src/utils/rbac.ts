/**
 * rbac.ts
 *
 * Centralized Role-Based Access Control (RBAC) for Skill Era.
 *
 * Role hierarchy (ascending privilege):
 *   user < admin < finance_admin < super_admin
 *
 * Usage:
 *   hasRole(currentUser.role, 'admin')  // true for admin, finance_admin, super_admin
 *   hasRole(currentUser.role, 'finance_admin')  // true for finance_admin, super_admin
 *   hasRole(currentUser.role, 'super_admin')  // true for super_admin only
 */

export type UserRole = 'user' | 'admin' | 'finance_admin' | 'super_admin';

/**
 * Numeric privilege level for each role.
 * Higher = more privileged.
 */
const ROLE_LEVEL: Record<UserRole, number> = {
    user: 0,
    admin: 1,
    finance_admin: 2,
    super_admin: 3,
};

/**
 * Returns true if `userRole` has at least the privilege level of `requiredRole`.
 *
 * Examples:
 *   hasRole('super_admin', 'admin')        → true
 *   hasRole('finance_admin', 'finance_admin') → true
 *   hasRole('admin', 'finance_admin')      → false
 *   hasRole('user', 'admin')               → false
 */
export function hasRole(userRole: string, requiredRole: UserRole): boolean {
    const userLevel = ROLE_LEVEL[userRole as UserRole] ?? -1;
    const requiredLevel = ROLE_LEVEL[requiredRole];
    return userLevel >= requiredLevel;
}
