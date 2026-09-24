import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

// ---------------------------------------------------------------------------
// Base URL — driven by environment variable so localhost is never hardcoded
// ---------------------------------------------------------------------------
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach JWT from localStorage on every request
// For multipart/form-data, remove Content-Type so browser sets boundary.
// ---------------------------------------------------------------------------
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('tracex_jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    // Let browser set multipart/form-data with correct boundary
    delete config.headers['Content-Type'];
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — centralised error handling
// ---------------------------------------------------------------------------
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const data = error.response?.data as Record<string, any> | undefined;
    const message =
      data?.error?.message ??
      data?.message ??
      data?.error ??
      error.message ??
      'An unexpected error occurred';

    (error as any).userMessage = message;

    if (error.response?.status === 401) {
      localStorage.removeItem('tracex_jwt_token');
      window.dispatchEvent(new CustomEvent('tracex:unauthorized'));
    }

    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// unwrapData — extract payload from { success, data } envelope.
// IMPORTANT: Always pass res.data (the response body), NOT the axios response.
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

// ---------------------------------------------------------------------------
// safeArray — safely extract an array from any backend response shape.
// Handles: direct array, {success,data:[]}, {data:[]}, {items:[]},
//          {results:[]}, or any caller-supplied key names.
// ALWAYS pass res.data (the response body), not the axios response object.
// ---------------------------------------------------------------------------
export function safeArray<T>(responseData: any, ...extraKeys: string[]): T[] {
  if (Array.isArray(responseData)) return responseData as T[];

  const unwrapped = unwrapData<any>(responseData);
  if (Array.isArray(unwrapped)) return unwrapped as T[];

  for (const key of extraKeys) {
    if (Array.isArray(responseData?.[key])) return responseData[key] as T[];
    if (Array.isArray(unwrapped?.[key])) return unwrapped[key] as T[];
  }

  const commonKeys = ['items', 'results', 'records'];
  for (const key of commonKeys) {
    if (Array.isArray(responseData?.[key])) return responseData[key] as T[];
    if (Array.isArray(unwrapped?.[key])) return unwrapped[key] as T[];
  }

  return [];
}
