const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
const TOKEN_KEY = 'hamint_token_v2';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const token = options.token === undefined ? getAuthToken() : options.token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(
      'APIサーバーに接続できません。`npm run dev` でサーバーが起動しているか確認してください。',
      0,
      'NETWORK_ERROR',
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  let payload: unknown = null;
  if (text) {
    if (contentType.includes('application/json')) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { error: { message: text.trim().slice(0, 300) } };
      }
    } else {
      payload = { error: { message: text.trim().slice(0, 300) } };
    }
  }
  if (!response.ok) {
    const errorBody = payload as
      | { error?: { message?: string; code?: string; details?: unknown } }
      | null;
    const message =
      response.status === 500 && !errorBody?.error?.message
        ? 'APIサーバーで500エラーが発生しました。APIサーバーの起動とDBマイグレーション（npm run db:migrate）を確認してください。'
        : (errorBody?.error?.message ?? `APIエラー (${response.status})`);
    throw new ApiError(
      message,
      response.status,
      errorBody?.error?.code ?? 'API_ERROR',
      errorBody?.error?.details,
    );
  }
  return payload as T;
}

export const api = {
  get<T>(path: string, token?: string | null): Promise<T> {
    return request<T>(path, { token });
  },
  post<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
    return request<T>(path, { method: 'POST', body, token });
  },
  patch<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
    return request<T>(path, { method: 'PATCH', body, token });
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },
};
