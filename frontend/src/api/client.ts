import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

// ---------------------------------------------------------------------------
// Base URL — driven by environment variable so localhost is never hardcoded
// ---------------------------------------------------------------------------
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach JWT from localStorage on every request
// ---------------------------------------------------------------------------
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('tracex_jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — unwrap {success, data} envelope from auth routes
// Some controllers (auth, entity-resolution, network, temporal, geospatial)
// return {success: true, data: ...}. Others return data directly.
// We normalise only when success+data envelope is present so that components
// that already read res.data.data keep working and components that read
// res.data for direct returns also keep working.
// ---------------------------------------------------------------------------
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Pull a user-friendly message from the backend error shape
    const data = error.response?.data as Record<string, any> | undefined;
    const message =
      data?.error?.message ??
      data?.message ??
      data?.error ??
      error.message ??
      'An unexpected error occurred';

    // Attach normalised message so components can use err.userMessage
    (error as any).userMessage = message;

    // On 401 clear the stored token so the login modal re-appears
    if (error.response?.status === 401) {
      localStorage.removeItem('tracex_jwt_token');
      // Emit an event so App can react without a hard coupling
      window.dispatchEvent(new CustomEvent('tracex:unauthorized'));
    }

    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Helper — extract data from the {success, data} envelope used by auth routes.
// Use this when the backend explicitly wraps: { success: true, data: ... }
// ---------------------------------------------------------------------------
export function unwrapData<T>(responseData: any): T {
  if (
    responseData !== null &&
    typeof responseData === 'object' &&
    'success' in responseData &&
    'data' in responseData
  ) {
    return responseData.data as T;
  }
  return responseData as T;
}
