import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard', '/wallet', '/tournaments', '/withdraw'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if route requires authentication
    const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

    if (isProtected) {
        // Check for accessToken cookie (set by backend as httpOnly)
        const hasAccessToken = request.cookies.has('accessToken');

        if (!hasAccessToken) {
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('returnUrl', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    // Redirect / to /dashboard
    if (pathname === '/') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
