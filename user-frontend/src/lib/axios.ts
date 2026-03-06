import axios from 'axios';

// ═══════════════════════════════════════════════════════════════════════
// AXIOS INSTANCE — User Frontend
// ═══════════════════════════════════════════════════════════════════════

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
    withCredentials: true,
    timeout: 10000,
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
        let csrfToken = getCookie('csrfToken');

        // Fallback to localStorage for cross-domain deployments where document.cookie is strictly isolated
        if (!csrfToken && typeof window !== 'undefined') {
            csrfToken = localStorage.getItem('csrfToken');
        }

        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
        } else if (process.env.NODE_ENV === 'development') {
            console.warn(
                '[CSRF] csrfToken not found in cookies or localStorage. POST/PUT/PATCH/DELETE requests will fail with 403. ' +
                'Ensure you are logged in and the backend returns the csrfToken.',
            );
        }
    }
    return config;
});

// ── Response Success Interceptor (Extract CSRF Token) ────
api.interceptors.response.use(
    (response) => {
        // If the backend returned a new CSRF token in the JSON body, save it for cross-domain usage
        const newCsrf = response.data?.data?.csrfToken;
        if (newCsrf && typeof window !== 'undefined') {
            localStorage.setItem('csrfToken', newCsrf);
        }
        return response;
    },
    (error) => {
        if (typeof window !== 'undefined') {
            if (!error.response) {
                // Network or Timeout
                window.dispatchEvent(new CustomEvent('api-error', { detail: { type: 'network' } }));
            } else {
                const status = error.response.status;
                if (status === 401) {
                    window.dispatchEvent(new CustomEvent('api-error', { detail: { type: 'unauthorized' } }));
                } else if (status === 409) {
                    window.dispatchEvent(new CustomEvent('api-error', { detail: { type: 'conflict' } }));
                } else {
                    window.dispatchEvent(new CustomEvent('api-error', {
                        detail: { type: 'generic', message: error.response.data?.message || 'An error occurred' },
                    }));
                }
            }
        }
        return Promise.reject(error);
    },
);

export default api;
