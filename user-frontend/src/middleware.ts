import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard', '/wallet', '/tournaments', '/withdraw'];

export function middleware(request: NextRequest) {
    // ════════════════════════════════════════════════════════════════════════
    // CROSS-DOMAIN WARNING
    // We cannot check for the 'accessToken' cookie here because Next.js
    // middleware runs on the frontend domain (e.g. netlify.app), but the
    // cookie is set by the backend domain (e.g. onrender.com).
    // The browser strictly isolates cookies, so request.cookies.has('accessToken')
    // will ALWAYS be false here in production, causing an infinite login loop.
    //
    // Protection is handled client-side via Axios interceptors and React Query.
    // ════════════════════════════════════════════════════════════════════════

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
