import axios from 'axios';
import { useAppStore } from './store';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
let resolvedApiBaseUrl = API_BASE_URL;
const AUTH_BYPASS_PATHS = ['/auth/login', '/auth/register'];
const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options']);

export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

function getErrorPayload(error: unknown): { message: string; status?: number; details?: unknown } {
  if (typeof error === 'object' && error) {
    const e = error as { message?: string; status?: number; errors?: unknown };
    return {
      message: String(e.message || 'Request failed'),
      status: e.status,
      details: e.errors,
    };
  }
  return { message: 'Request failed' };
}

const apiClient = axios.create({
  baseURL: resolvedApiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

function swapLocalApiPort(baseUrl?: string): string | null {
  if (!baseUrl) return null;
  try {
    const parsed = new URL(baseUrl);
    const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (!isLocalHost) return null;
    if (parsed.port === '5000') {
      parsed.port = '5001';
      return parsed.toString().replace(/\/$/, '');
    }
    if (parsed.port === '5001') {
      parsed.port = '5000';
      return parsed.toString().replace(/\/$/, '');
    }
    return null;
  } catch {
    return null;
  }
}

export function getResolvedApiBaseUrl() {
  return resolvedApiBaseUrl;
}

// Add token to requests
apiClient.interceptors.request.use(
  (config) => {
    const requestUrl = config.url || '';
    const isAuthBypassRequest = AUTH_BYPASS_PATHS.some((path) => requestUrl.includes(path));
    const token = localStorage.getItem('token');
    if (token && !isAuthBypassRequest) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    try {
      const projectId = useAppStore.getState().projectId || 'default';
      config.headers['X-Project-Id'] = projectId;
    } catch {
      // ignore
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config || {};
    const method = String(originalRequest.method || '').toLowerCase();
    const isIdempotent = IDEMPOTENT_METHODS.has(method);
    const requestBaseUrl = originalRequest.baseURL || apiClient.defaults.baseURL || resolvedApiBaseUrl;
    const fallbackBaseUrl = swapLocalApiPort(requestBaseUrl);

    if (!error.response && fallbackBaseUrl && !originalRequest.__portFallbackRetried) {
      originalRequest.__portFallbackRetried = true;
      originalRequest.baseURL = fallbackBaseUrl;
      resolvedApiBaseUrl = fallbackBaseUrl;
      apiClient.defaults.baseURL = fallbackBaseUrl;
      return apiClient(originalRequest);
    }

    const shouldRetry = !originalRequest.__retried && isIdempotent && (!error.response || error.response.status >= 500);
    if (shouldRetry) {
      originalRequest.__retried = true;
      await new Promise((resolve) => setTimeout(resolve, 350));
      return apiClient(originalRequest);
    }

    console.error('API Error:', error);
    const requestUrl = error?.config?.url || '';
    const isAuthBypassRequest = AUTH_BYPASS_PATHS.some((path) => requestUrl.includes(path));

    if (error.response?.status === 401 && !isAuthBypassRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      try {
        const store = useAppStore.getState();
        store.setToken(null);
        store.setUser(null);
        store.setIsAuthenticated(false);
      } catch {
        // ignore store update issues
      }
    }
    throw getErrorPayload(error.response?.data || error);
  }
);

// Authentication APIs
export const authAPI = {
  register: (data: Record<string, unknown>) => apiClient.post('/auth/register', data),
  login: (email: string, password: string) => apiClient.post('/auth/login', { email, password }),
  logout: () => apiClient.post('/auth/logout'),
  getProfile: () => apiClient.get('/auth/profile'),
  updateProfile: (data: Record<string, unknown>) => apiClient.put('/auth/profile', data),
  changePassword: (data: Record<string, unknown>) => apiClient.post('/auth/change-password', data),
};

// AI APIs
export const aiAPI = {
  generateTestCases: (data: Record<string, unknown>) => apiClient.post('/ai/generate-test-cases', data),
  detectAmbiguities: (data: Record<string, unknown>) => apiClient.post('/ai/detect-ambiguities', data),
  prioritizeTestCases: (data: Record<string, unknown>) => apiClient.post('/ai/prioritize-test-cases', data),
  generateAutomationScript: (data: Record<string, unknown>) => apiClient.post('/ai/generate-automation-script', data),
  detectDuplicates: (data: Record<string, unknown>) => apiClient.post('/ai/detect-duplicates', data),
  generateNegativeTestCases: (data: Record<string, unknown>) => apiClient.post('/ai/generate-negative-test-cases', data),
  getTraceabilityMatrix: (projectId: string) => apiClient.get(`/ai/traceability-matrix?projectId=${projectId}`),
  getCoverageAnalysis: (projectId: string) => apiClient.get(`/ai/coverage-analysis?projectId=${projectId}`),
  assessRisk: (data: Record<string, unknown>) => apiClient.post('/ai/assess-risk', data),
  getDashboardMetrics: (projectId: string) => apiClient.get(`/ai/dashboard-metrics?projectId=${projectId}`),
  getSupportedActions: () => apiClient.get('/ai/supported-actions'),
  getAISettings: () => apiClient.get('/ai/settings'),
  updateAISettings: (data: Record<string, unknown>) => apiClient.put('/ai/settings', data),
  listPromptTemplates: (params?: { action?: string }) => apiClient.get('/ai/templates', { params }),
  createPromptTemplate: (data: Record<string, unknown>) => apiClient.post('/ai/templates', data),
  updatePromptTemplate: (templateId: string, data: Record<string, unknown>) => apiClient.put(`/ai/templates/${templateId}`, data),
  archivePromptTemplate: (templateId: string) => apiClient.delete(`/ai/templates/${templateId}`),
};

// Test Case APIs
export const testCaseAPI = {
  create: (data: Record<string, unknown>) => apiClient.post('/test-cases', data),
  getAll: (params: Record<string, unknown>) => apiClient.get('/test-cases', { params }),
  getById: (id: string) => apiClient.get(`/test-cases/${id}`),
  update: (id: string, data: Record<string, unknown>) => apiClient.put(`/test-cases/${id}`, data),
  delete: (id: string) => apiClient.delete(`/test-cases/${id}`),
  bulkDelete: (data: Record<string, unknown>) => apiClient.post('/test-cases/bulk-delete', data),
  export: (params: Record<string, unknown>) => apiClient.get('/test-cases/export', { params, responseType: 'blob' }),
};

// Requirement APIs
export const requirementAPI = {
  create: (data: Record<string, unknown>) => apiClient.post('/requirements', data),
  getAll: (params: Record<string, unknown>) => apiClient.get('/requirements', { params }),
  getById: (id: string) => apiClient.get(`/requirements/${id}`),
  update: (id: string, data: Record<string, unknown>) => apiClient.put(`/requirements/${id}`, data),
  delete: (id: string) => apiClient.delete(`/requirements/${id}`),
};

// Test Run APIs
export const testRunAPI = {
  create: (data: { framework: string; command?: string; externalUrl?: string; execute?: boolean }) =>
    apiClient.post('/test-runs', data),
  list: (params?: { status?: string }) => apiClient.get('/test-runs', { params }),
  get: (runId: string) => apiClient.get(`/test-runs/${runId}`),
  execute: (runId: string) => apiClient.post(`/test-runs/${runId}/execute`),
  cancel: (runId: string) => apiClient.post(`/test-runs/${runId}/cancel`),
};

// Projects APIs
export const projectAPI = {
  list: () => apiClient.get('/projects'),
  create: (data: { name: string; description?: string; projectId?: string }) => apiClient.post('/projects', data),
  update: (projectId: string, data: { name?: string; description?: string }) => apiClient.put(`/projects/${projectId}`, data),
  archive: (projectId: string) => apiClient.delete(`/projects/${projectId}`),
};

export default apiClient;
