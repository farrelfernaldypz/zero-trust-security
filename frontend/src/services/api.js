import { readSession, removeSession, writeSession } from './session.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
let accessReporter = () => {};
let refreshPromise = null;

export class ApiError extends Error {
  constructor(message, status = null, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function setAccessReporter(reporter) {
  accessReporter = reporter;
}

function endpointLabel(path) {
  return `${path}`;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: 'Gateway mengirim respons yang tidak dapat dibaca.' };
  }
}

function getErrorMessage(payload, status) {
  if (payload && typeof payload.error === 'string') {
    return payload.error;
  }
  if (payload && typeof payload.message === 'string') {
    return payload.message;
  }
  if (status === 502) {
    return 'Layanan backend sedang tidak dapat dijangkau.';
  }
  return status ? `Permintaan gagal dengan status ${status}.` : 'Gateway tidak dapat dijangkau.';
}

function reportAccess({ path, status, message, allowed }) {
  accessReporter({
    id: `${Date.now()}-${Math.random()}`,
    endpoint: endpointLabel(path),
    status,
    message,
    allowed,
    createdAt: new Date().toISOString(),
  });
}

async function sendRequest(path, options, retryAfterRefresh = true) {
  const {
    method = 'GET',
    body,
    auth = true,
    deviceId,
    report = true,
  } = options;
  const session = readSession();
  const headers = new Headers({ Accept: 'application/json' });

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth && session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  if (deviceId || (auth && session?.deviceId)) {
    headers.set('X-Device-ID', deviceId || session.deviceId);
  }

  let response;
  let payload;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    payload = await parseResponse(response);
  } catch {
    const error = new ApiError('Tidak dapat terhubung ke API Gateway.', null);
    if (report) {
      reportAccess({ path, status: null, message: error.message, allowed: false });
    }
    throw error;
  }

  if (response.status === 401 && auth && retryAfterRefresh && !path.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return sendRequest(path, options, false);
    }
    removeSession();
  }

  if (!response.ok) {
    const error = new ApiError(getErrorMessage(payload, response.status), response.status, payload);
    if (report) {
      reportAccess({ path, status: response.status, message: error.message, allowed: false });
    }
    throw error;
  }

  if (report) {
    reportAccess({
      path,
      status: response.status,
      message: payload?.message || 'Permintaan diizinkan oleh Gateway.',
      allowed: true,
    });
  }
  return payload;
}

async function refreshAccessToken() {
  const session = readSession();
  if (!session?.refreshToken) {
    return false;
  }
  if (!refreshPromise) {
    refreshPromise = sendRequest('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: session.refreshToken },
      auth: false,
      report: false,
    }, false)
      .then(tokens => {
        const current = readSession();
        if (!current) {
          return false;
        }
        writeSession({ ...current, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
        reportAccess({
          path: '/auth/refresh',
          status: 200,
          message: 'Sesi berhasil diperbarui oleh Gateway.',
          allowed: true,
        });
        return true;
      })
      .catch(() => {
        removeSession();
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export function apiRequest(path, options = {}) {
  return sendRequest(path, options);
}

export async function logoutSession() {
  const session = readSession();
  try {
    if (session?.refreshToken) {
      await sendRequest('/auth/logout', {
        method: 'POST',
        body: { refreshToken: session.refreshToken },
        auth: false,
        report: false,
      }, false);
    }
  } finally {
    removeSession();
  }
}
