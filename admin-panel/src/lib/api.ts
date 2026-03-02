import axios from 'axios';

// ═══════════════════════════════════════════════════════════════════════
// AXIOS INSTANCE — Admin Panel
// ═══════════════════════════════════════════════════════════════════════

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ── Cookie reader utility ────────────────────────────────
function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

// ── CSRF Request Interceptor ─────────────────────────────
// Reads csrfToken cookie (non-httpOnly, set by backend on login/register/refresh)
// and attaches it as X-CSRF-Token header on state-changing requests.
const CSRF_METHODS = ['post', 'put', 'patch', 'delete'];

api.interceptors.request.use((config) => {
    if (config.method && CSRF_METHODS.includes(config.method.toLowerCase())) {
        const csrfToken = getCookie('csrfToken');
        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
        } else if (process.env.NODE_ENV === 'development') {
            console.warn(
                '[CSRF] csrfToken cookie not found. POST/PUT/PATCH/DELETE requests will fail with 403. ' +
                'Ensure you are logged in and the backend sets the csrfToken cookie.',
            );
        }
    }
    return config;
});

// ── Token Refresh Interceptor ────────────────────────────
// Track refresh in-flight to avoid parallel refresh calls
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
}> = [];

function processQueue(error: unknown) {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(undefined);
        }
    });
    failedQueue = [];
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Only intercept 401s, skip if already retried or is a refresh/login call
        if (
            error.response?.status !== 401 ||
            originalRequest._retry ||
            originalRequest.url?.includes('/auth/refresh') ||
            originalRequest.url?.includes('/auth/login')
        ) {
            return Promise.reject(error);
        }

        if (isRefreshing) {
            // Queue this request until refresh completes
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then(() => api(originalRequest));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
            await api.post('/auth/refresh');
            processQueue(null);
            return api(originalRequest);
        } catch (refreshError) {
            processQueue(refreshError);
            // Redirect to login on refresh failure
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    },
);

export default api;
