export type ApiErrorKind =
  | 'offline'
  | 'network'
  | 'timeout'
  | 'backend-down'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'rate-limited'
  | 'server-error'
  | 'client-error'
  | 'bad-response';

export type ApiError = {
  kind: ApiErrorKind;
  // what failed, in one line
  title: string;
  // why it failed
  why: string;
  // what to do about it
  fix: string;
  // the server's own explanation, when it sent one
  serverMessage?: string;
  // the raw exception or error code underneath
  cause?: string;
  retryable: boolean;
};

export type ApiResult = {
  ok: boolean;
  method: string;
  url: string;
  // 0 when the request never got a response
  status: number;
  statusText: string;
  contentType: string | null;
  ms: number;
  body: unknown;
  at: Date;
  // null exactly when ok is true
  error: ApiError | null;
};

const TIMEOUT_MS = 10_000;
// Where the API runs. Empty means the same site as this page
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const API_TARGET = API_URL || location.origin;
const START_SERVER = 'Start it with "npm run dev" in the server folder, then retry.';

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  408: 'Request Timeout',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

// Full URL of a server path such as /login or /api/me
export const apiUrl = (path: string) => API_URL + path;

// credentials: 'omit' sends the request without the session cookie, as a signed-out visitor would
export async function callApi(path: string, init?: Pick<RequestInit, 'credentials'>): Promise<ApiResult> {
  const started = performance.now();
  const elapsed = () => Math.max(1, Math.round(performance.now() - started));
  const base = { method: 'GET', url: path };

  let r: Response;
  let text: string;
  try {
    // 'include' sends the session cookie even though the API is on another origin
    r = await fetch(apiUrl(path), { credentials: 'include', ...init, headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    text = await r.text();
  } catch (e) {
    return {
      ...base,
      ok: false,
      status: 0,
      statusText: '',
      contentType: null,
      ms: elapsed(),
      body: null,
      at: new Date(),
      error: describeThrown(e),
    };
  }

  let body: unknown = text;
  let isJson = false;
  try {
    body = JSON.parse(text);
    isJson = true;
  } catch {
    // not JSON (e.g. a proxy error page): keep the raw text
  }

  const contentType = r.headers.get('content-type');
  const error = describeResponse(r.status, body, isJson, contentType);
  return {
    ...base,
    ok: error === null,
    status: r.status,
    statusText: r.statusText || STATUS_TEXT[r.status] || '',
    contentType,
    ms: elapsed(),
    body,
    at: new Date(),
    error,
  };
}

// fetch() rejected: there is no response at all
function describeThrown(e: unknown): ApiError {
  const cause = e instanceof Error ? `${e.name}: ${e.message}` : String(e);

  if (e instanceof DOMException && e.name === 'TimeoutError') {
    return {
      kind: 'timeout',
      title: 'The request timed out.',
      why: `No answer arrived within ${TIMEOUT_MS / 1000} seconds, so the request was cancelled. The server is running too slowly or is stuck.`,
      fix: 'Retry in a moment. If it keeps happening, check the server terminal for a hung request.',
      cause,
      retryable: true,
    };
  }

  if (!navigator.onLine) {
    return {
      kind: 'offline',
      title: 'You are offline.',
      why: 'The browser reports no network connection, so the request never left this machine.',
      fix: 'Reconnect to the network, then retry.',
      cause,
      retryable: true,
    };
  }

  return {
    kind: 'network',
    title: "Couldn't reach the API server.",
    why: `The browser got no usable response from ${API_TARGET}. Either the API server is not running, or it does not allow requests from ${location.origin} (CORS).`,
    fix: `${START_SERVER} If it is running, check that CORS_ORIGINS or FRONTEND_URL in server/.env is ${location.origin}.`,
    cause,
    retryable: true,
  };
}

// A response arrived: null means it is a usable success
function describeResponse(status: number, body: unknown, isJson: boolean, contentType: string | null): ApiError | null {
  const label = statusLabel(status);
  const serverMessage = readServerMessage(body, contentType);

  if (status >= 200 && status < 300) {
    if (isJson) return null;
    return {
      kind: 'bad-response',
      title: 'The server sent something that is not JSON.',
      why: `The response was ${label} with content type "${contentType ?? 'none'}", but this endpoint should return JSON. Usually the request hit a web page (such as the app's index.html) instead of an API route.`,
      fix: 'Check the URL and that the API route exists on the server.',
      retryable: false,
    };
  }

  if (status >= 502 && status <= 504 && body === '') {
    return {
      kind: 'backend-down',
      title: 'The API server is not running.',
      why: `The proxy in front of the API got no response from ${API_TARGET}. The API server is stopped or not reachable.`,
      fix: `${START_SERVER} If it exits straight away, read the error in its terminal (often a missing value in server/.env).`,
      cause: `${label} with an empty body from the proxy`,
      retryable: true,
    };
  }

  if (status === 401) {
    return {
      kind: 'unauthorized',
      title: 'You are not signed in.',
      why: 'The server found no valid session cookie on this request. Either you have not signed in yet or the session has expired.',
      fix: 'Sign in again to get a new session.',
      serverMessage,
      retryable: false,
    };
  }

  if (status === 403) {
    return {
      kind: 'forbidden',
      title: 'You are not allowed to do this.',
      why: 'The server recognised your session but refused the request: your account lacks permission for this resource.',
      fix: 'Ask an administrator for access, or sign in with a different account.',
      serverMessage,
      retryable: false,
    };
  }

  if (status === 404) {
    return {
      kind: 'not-found',
      title: 'This endpoint does not exist.',
      why: 'The server is running, but it has no route for this URL.',
      fix: 'Check the path for typos and that the route is defined in server/index.ts.',
      serverMessage,
      retryable: false,
    };
  }

  if (status === 429) {
    return {
      kind: 'rate-limited',
      title: 'Too many requests.',
      why: 'The server is rate limiting this client.',
      fix: 'Wait a little, then retry.',
      serverMessage,
      retryable: true,
    };
  }

  if (status >= 500) {
    return {
      kind: 'server-error',
      title: 'The server hit an error.',
      why: `The server received the request but failed while handling it (${label}). The fault is on the server, not in what was sent.`,
      fix: 'Check the server terminal for the stack trace, then retry.',
      serverMessage,
      retryable: true,
    };
  }

  return {
    kind: 'client-error',
    title: 'The server rejected the request.',
    why: `The server answered ${label}, which means it considers the request itself invalid.`,
    fix: 'Check the request URL and parameters.',
    serverMessage,
    retryable: false,
  };
}

function readServerMessage(body: unknown, contentType: string | null) {
  if (typeof body === 'string') {
    const text = contentType?.includes('html') ? body.replace(/<[^>]+>/g, ' ') : body;
    return text.replace(/\s+/g, ' ').trim().slice(0, 300) || undefined;
  }
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    for (const key of ['message', 'error_description', 'error']) {
      if (typeof b[key] === 'string' && b[key]) return b[key];
    }
  }
  return undefined;
}

export function statusLabel(status: number) {
  if (status === 0) return 'No response';
  return STATUS_TEXT[status] ? `${status} ${STATUS_TEXT[status]}` : String(status);
}
