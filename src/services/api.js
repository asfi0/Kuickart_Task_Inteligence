const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://kti-backend.onrender.com/api').replace(/\/$/, '');

const ACCESS_TOKEN_KEY = 'kuickart_access_token';
const REFRESH_TOKEN_KEY = 'kuickart_refresh_token';

function buildUrl(path, query) {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

function readStoredToken(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export function getAccessToken() {
  return readStoredToken(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return readStoredToken(REFRESH_TOKEN_KEY);
}

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function parseResponse(response) {
  const raw = await response.text();
  let data = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    const message =
      (typeof data === 'object' && data?.message && Array.isArray(data.message)
        ? data.message.join(', ')
        : typeof data === 'object' && data?.message
          ? data.message
          : typeof data === 'string' && data
            ? data
            : `Request failed with status ${response.status}`);

    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

let refreshPromise = null;

export async function refreshSession() {
  if (!getRefreshToken()) {
    throw new Error('No refresh token available');
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: getRefreshToken() }),
      });

      const data = await parseResponse(response);
      setTokens(data);
      return data;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function apiRequest(path, options = {}, { allowRefresh = true } = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    query,
    auth = true,
  } = options;

  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  if (body !== undefined && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (auth) {
    const accessToken = getAccessToken();
    if (accessToken) {
      requestHeaders.Authorization = `Bearer ${accessToken}`;
    }
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && auth && allowRefresh && getRefreshToken() && path !== '/auth/refresh') {
    try {
      await refreshSession();
      return apiRequest(path, options, { allowRefresh: false });
    } catch {
      clearTokens();
    }
  }

  return parseResponse(response);
}

export const authApi = {
  login(payload) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: payload,
      auth: false,
    }, { allowRefresh: false });
  },
  me() {
    return apiRequest('/auth/me');
  },
  logout(payload) {
    return apiRequest('/auth/logout', {
      method: 'POST',
      body: payload,
    }, { allowRefresh: false });
  },
};

export const coreApi = {
  getUsers(query) {
    return apiRequest('/users', { query });
  },
  getTasks(query) {
    return apiRequest('/tasks', { query });
  },
  createTask(payload) {
    return apiRequest('/tasks', { method: 'POST', body: payload });
  },
  startTask(taskId) {
    return apiRequest(`/tasks/${taskId}/start`, { method: 'PATCH' });
  },
  submitTask(taskId) {
    return apiRequest(`/tasks/${taskId}/submit`, { method: 'POST' });
  },
  approveTask(taskId) {
    return apiRequest(`/tasks/${taskId}/approve`, { method: 'POST' });
  },
  rejectTask(taskId, reason) {
    return apiRequest(`/tasks/${taskId}/reject`, { method: 'POST', body: { reason } });
  },
  getRoles(query) {
    return apiRequest('/roles', { query });
  },
  getSubUnits(query) {
    return apiRequest('/subunits', { query });
  },
  getTaskTemplates(query) {
    return apiRequest('/task-templates', { query });
  },
  getKpi(query) {
    return apiRequest('/kpi', { query });
  },
  getAlerts(query) {
    return apiRequest('/alerts', { query });
  },
  getReports(query) {
    return apiRequest('/reports', { query });
  },
  getActivityLogs(query) {
    return apiRequest('/activity-logs', { query });
  },
  getCountries(query) {
    return apiRequest('/countries', { query });
  },
  getDivisions(query) {
    return apiRequest('/divisions', { query });
  },
};

export { API_BASE_URL };
