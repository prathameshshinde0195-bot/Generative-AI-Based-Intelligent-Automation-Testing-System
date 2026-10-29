import axios from 'axios';
import { useAppStore } from './store';

const PRODUCTION_BACKEND_URL = 'https://genai-testing-system-api.onrender.com/api';
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? PRODUCTION_BACKEND_URL : 'http://127.0.0.1:5001/api');
const AUTH_BYPASS_PATHS = ['/auth/login', '/auth/register'];
const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options']);
const AUTH_FALLBACK_BASES = import.meta.env.PROD
  ? [PRODUCTION_BACKEND_URL]
  : ['http://localhost:5001/api', 'http://127.0.0.1:5001/api', 'http://localhost:5000/api', 'http://127.0.0.1:5000/api'];
const GLOBAL_FALLBACK_BASES = import.meta.env.PROD
  ? [PRODUCTION_BACKEND_URL]
  : ['http://localhost:5001/api', 'http://127.0.0.1:5001/api', 'http://localhost:5000/api', 'http://127.0.0.1:5000/api'];


export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

function getErrorPayload(error: unknown): { message: string; status?: number; details?: unknown } {
  if (typeof error === 'object' && error) {
    const e = error as {
      message?: string;
      status?: number;
      errors?: unknown;
      response?: { status?: number; data?: { message?: string } };
    };
    const status = e.status || e.response?.status;
    const message = e.response?.data?.message || e.message || 'Request failed';
    return {
      message: String(message),
      status,
      details: e.errors,
    };
  }
  return { message: 'Request failed' };
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function postAuthWithFallback(path: '/auth/login' | '/auth/register' | '/auth/google', data: Record<string, unknown>) {
  try {
    return await apiClient.post(path, data);
  } catch (error) {
    const payload = getErrorPayload(error);
    const isNetworkLike = !payload.status;
    if (!isNetworkLike) throw error;

    // In local development, some setups miss Vite proxy or origin mapping.
    // Retry directly against common backend URLs before failing.
    for (const base of AUTH_FALLBACK_BASES) {
      try {
        const response = await axios.post(`${base}${path}`, data, {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' },
        });
        return response.data;
      } catch {
        // try next fallback
      }
    }
    throw error;
  }
}

async function postWithDirectFallback(path: string, data: Record<string, unknown>) {
  try {
    return await apiClient.post(path, data);
  } catch (error) {
    const payload = getErrorPayload(error);
    // If backend returned an HTTP response, don't mask it.
    if (payload.status) throw error;

    const token = localStorage.getItem('token');
    let projectId = 'default';
    try {
      projectId = useAppStore.getState().projectId || 'default';
    } catch {
      // ignore
    }

    for (const base of GLOBAL_FALLBACK_BASES) {
      try {
        const response = await axios.post(`${base}${path}`, data, {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'X-Project-Id': projectId,
          },
        });
        return response.data;
      } catch {
        // try next base
      }
    }

    throw error;
  }
}

function joinBaseAndPath(base: string, url: string) {
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

async function retryWithGlobalFallback(error: unknown) {
  const err = error as {
    config?: Record<string, unknown>;
    response?: { status?: number };
  };
  const originalRequest = (err?.config || {}) as Record<string, unknown> & {
    url?: string;
    method?: string;
    baseURL?: string;
    headers?: Record<string, unknown>;
    __fallbackTried?: boolean;
  };

  if (!originalRequest.url || originalRequest.__fallbackTried) {
    throw error;
  }
  if (err?.response?.status) {
    // This is an HTTP error from server, not a network resolution/connectivity issue.
    throw error;
  }

  for (const base of GLOBAL_FALLBACK_BASES) {
    try {
      const requestClone = {
        ...originalRequest,
        __fallbackTried: true,
        baseURL: undefined,
        url: joinBaseAndPath(base, originalRequest.url),
      };
      return await axios(requestClone as any);
    } catch {
      // try next base
    }
  }

  throw error;
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
    try {
      const retried = await retryWithGlobalFallback(error);
      return retried.data;
    } catch {
      // continue normal error handling
    }

    const originalRequest = error.config || {};
    const method = String(originalRequest.method || '').toLowerCase();
    const isIdempotent = IDEMPOTENT_METHODS.has(method);
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
      Object.keys(localStorage)
        .filter((k) => k.startsWith('chatSessionId_'))
        .forEach((k) => localStorage.removeItem(k));
      try {
        const store = useAppStore.getState();
        store.clearUserScopedData();
        store.setToken(null);
        store.setUser(null);
        store.setIsAuthenticated(false);
      } catch {
        // ignore store update issues
      }
    }
    throw getErrorPayload(error);
  }
);

// Authentication APIs
export const authAPI = {
  register: (data: Record<string, unknown>) => postAuthWithFallback('/auth/register', data),
  login: (email: string, password: string) => postAuthWithFallback('/auth/login', { email, password }),
  googleLogin: (data: { credential?: string; idToken?: string; accessToken?: string; email?: string; name?: string; picture?: string; googleId?: string }) =>
    postAuthWithFallback('/auth/google', data),
  logout: () => apiClient.post('/auth/logout'),
  getProfile: () => apiClient.get('/auth/profile'),
  getMe: () => apiClient.get('/auth/me'),
  updateProfile: (data: Record<string, unknown>) => apiClient.put('/auth/profile', data),
  changePassword: (data: Record<string, unknown>) => apiClient.post('/auth/change-password', data),
  forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) => apiClient.post('/auth/reset-password', { token, newPassword }),
  verifyEmail: (token: string) => apiClient.get(`/auth/verify-email/${token}`),
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
  createPromptTemplate: (data: Record<string, unknown>) => postWithDirectFallback('/ai/templates', data),
  updatePromptTemplate: (templateId: string, data: Record<string, unknown>) => apiClient.put(`/ai/templates/${templateId}`, data),
  archivePromptTemplate: (templateId: string) => apiClient.delete(`/ai/templates/${templateId}`),
  // Feature 1: Requirement Change Impact Predictor
  analyzeChangeImpact: (data: Record<string, unknown>) => apiClient.post('/ai/change-impact', data),
  getChangeImpactHistory: (projectId: string) => apiClient.get(`/ai/change-impact/history?projectId=${projectId}`),
  // Feature 2: AI Test Data Generator
  generateTestData: (data: Record<string, unknown>) => apiClient.post('/ai/generate-test-data', data),
  getTestDataHistory: (projectId: string) => apiClient.get(`/ai/generate-test-data/history?projectId=${projectId}`),
  // Feature 3: Conversational Test Case Chatbot
  chatTestCase: (data: Record<string, unknown>) => apiClient.post('/ai/chat-testcase', data),
  chatTestCaseStream: async (
    data: Record<string, unknown>,
    onChunk: (chunk: string) => void,
    onDone: (result: Record<string, unknown>) => void,
    onError: (error: string) => void,
  ) => {
    const token = localStorage.getItem('token');
    let projectId = 'default';
    try {
      projectId = useAppStore.getState().projectId || 'default';
    } catch {
      // ignore
    }

    // Try the main URL first, then fallback bases
    const urlsToTry = [
      `${API_BASE_URL}/ai/chat-testcase/stream`,
      ...GLOBAL_FALLBACK_BASES.map(base => `${base}/ai/chat-testcase/stream`),
    ];

    let lastError = '';
    for (const url of urlsToTry) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'X-Project-Id': projectId,
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errBody = await response.text();
          lastError = errBody || `HTTP ${response.status}`;
          continue;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          lastError = 'No readable stream';
          continue;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              try {
                const event = JSON.parse(jsonStr);
                if (event.type === 'chunk') {
                  onChunk(event.content);
                } else if (event.type === 'done') {
                  onDone(event.data);
                } else if (event.type === 'error') {
                  onError(event.message);
                }
              } catch {
                // skip malformed SSE event
              }
            }
          }
        }

        // Process any trailing lines left in buffer after stream ends
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              try {
                const event = JSON.parse(jsonStr);
                if (event.type === 'chunk') {
                  onChunk(event.content);
                } else if (event.type === 'done') {
                  onDone(event.data);
                } else if (event.type === 'error') {
                  onError(event.message);
                }
              } catch {
                // skip malformed SSE event
              }
            }
          }
        }
        return; // success
      } catch {
        lastError = 'Network error';
      }
    }
    onError(lastError || 'Failed to connect to server');
  },
  saveChatTestCases: (data: Record<string, unknown>) => apiClient.post('/ai/chat-testcase/save', data),
  getChatSessions: (projectId: string) => apiClient.get(`/ai/chat-testcase/sessions?projectId=${projectId}`),
  getChatSessionHistory: (sessionId: string, projectId: string) => apiClient.get(`/ai/chat-testcase/history/${sessionId}?projectId=${projectId}`),
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

// Per-user SRS history (MongoDB, scoped by authenticated user)
export const historyAPI = {
  listSrs: (projectId: string) => apiClient.get('/history/srs', { params: { projectId } }),
  createSrs: (data: Record<string, unknown>) => apiClient.post('/history/srs', data),
  deleteSrs: (id: string) => apiClient.delete(`/history/srs/${id}`),
};

export default apiClient;

