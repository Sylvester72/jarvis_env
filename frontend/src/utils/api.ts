import { useAppStore } from '../store/index';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  ok: boolean;
  error?: string;
}

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const BASE_URL = 'http://localhost:8080/api/v1';
const DEFAULT_TIMEOUT = 30000;

async function request<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { apiEndpoint } = useAppStore.getState();
  const baseUrl = apiEndpoint || BASE_URL;

  const {
    method = 'GET',
    headers = {},
    body,
    params,
    timeout = DEFAULT_TIMEOUT,
    signal,
  } = options;

  const url = new URL(`${baseUrl}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const mergedSignal = signal
    ? combineSignals(signal, controller.signal)
    : controller.signal;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Client-Name': 'jarvis-desktop',
    'X-Client-Version': '1.0.0',
  };

  const { apiKey } = useAppStore.getState();
  if (apiKey) {
    defaultHeaders['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: { ...defaultHeaders, ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: mergedSignal,
    });

    clearTimeout(timeoutId);

    let data: T;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = (await response.text()) as unknown as T;
    }

    if (!response.ok) {
      throw new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        data
      );
    }

    return { data, status: response.status, ok: true };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out', 408);
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error',
      0
    );
  }
}

function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

export const api = {
  get: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),

  upload: <T = unknown>(
    endpoint: string,
    file: File | Blob,
    filename?: string,
    options?: RequestOptions
  ) => {
    const formData = new FormData();
    formData.append('file', file, filename);
    return request<T>(endpoint, {
      ...options,
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: formData,
    });
  },
};

export const endpoints = {
  chat: {
    send: (conversationId: string) => `/chat/${conversationId}/messages`,
    stream: (conversationId: string) => `/chat/${conversationId}/stream`,
    conversations: '/chat/conversations',
    conversation: (id: string) => `/chat/conversations/${id}`,
  },
  voice: {
    transcribe: '/voice/transcribe',
    synthesize: '/voice/synthesize',
    recognize: '/voice/recognize',
    streaming: '/voice/stream',
  },
  vision: {
    analyze: '/vision/analyze',
    ocr: '/vision/ocr',
    detect: '/vision/detect',
  },
  memory: {
    search: '/memory/search',
    store: '/memory/store',
    recall: '/memory/recall',
    timeline: '/memory/timeline',
  },
  plugins: {
    list: '/plugins',
    plugin: (id: string) => `/plugins/${id}`,
    toggle: (id: string) => `/plugins/${id}/toggle`,
  },
  system: {
    status: '/system/status',
    health: '/system/health',
    config: '/system/config',
    models: '/system/models',
  },
};

export { ApiError };
export type { ApiResponse, RequestOptions };
