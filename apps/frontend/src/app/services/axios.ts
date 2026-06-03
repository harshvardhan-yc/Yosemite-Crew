import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { hardSignOut } from '@/app/hooks/useAuth';
import { logger } from '@/app/lib/logger';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

type GetDataParams = Record<string, unknown>;
type GetDataOptions = {
  suppressStatuses?: number[];
  dedupe?: boolean;
};

type RetriableAxiosRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRedirect?: boolean;
};

type AuthRedirectError = Error & {
  __ycAuthRedirect: true;
};

const inFlightGetRequests = new Map<string, Promise<AxiosResponse<unknown>>>();
let unauthorizedSessionPromise: Promise<void> | null = null;

const AUTH_REDIRECT_ERROR_NAME = 'AuthRedirectError';
const PUBLIC_API_PREFIXES = ['/v1/contact-us/contact-web'];
const PUBLIC_PATHS = new Set([
  '/',
  '/about-us',
  '/accessibility',
  '/contact',
  '/forgot-password',
  '/pet-businesses',
  '/pet-parents',
  '/pricing',
  '/signin',
  '/signup',
]);

const createAuthRedirectError = (): AuthRedirectError => {
  const error = new Error('Authentication required. Redirecting to sign in.') as AuthRedirectError;
  error.name = AUTH_REDIRECT_ERROR_NAME;
  error.__ycAuthRedirect = true;
  return error;
};

export const isAuthRedirectError = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === 'object' &&
    ('__ycAuthRedirect' in error || (error as { name?: string }).name === AUTH_REDIRECT_ERROR_NAME)
  );

const isBrowser = () => typeof globalThis.window !== 'undefined';

const getCurrentRoute = () => {
  if (!isBrowser()) return '/';
  const { pathname, search } = globalThis.window.location;
  return `${pathname}${search}`;
};

const shouldRedirectToSignIn = () => {
  if (!isBrowser()) return false;
  const { pathname } = globalThis.window.location;
  if (PUBLIC_PATHS.has(pathname)) return false;
  if (pathname.startsWith('/dev-docs') || pathname.startsWith('/accessibility/')) return false;
  return !pathname.startsWith('/signin');
};

const redirectToSignIn = () => {
  if (!shouldRedirectToSignIn()) return;
  const next = encodeURIComponent(getCurrentRoute());
  try {
    globalThis.window.location.replace(`/signin?next=${next}`);
  } catch (error) {
    logger.warn('Failed to redirect to sign in after auth loss', error);
  }
};

const normalizeRequestPath = (url?: string) => {
  if (!url) return '';
  try {
    return new URL(url, BASE_URL || globalThis.window?.location?.origin || 'http://localhost')
      .pathname;
  } catch {
    return url;
  }
};

const isPublicApiRequest = (config: AxiosRequestConfig) => {
  const path = normalizeRequestPath(config.url);
  return PUBLIC_API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

const handleUnauthorizedSession = async () => {
  if (!unauthorizedSessionPromise) {
    unauthorizedSessionPromise = hardSignOut()
      .catch((error) => {
        logger.warn('Failed to clear expired session cleanly', error);
      })
      .finally(() => {
        redirectToSignIn();
        unauthorizedSessionPromise = null;
      });
  }
  return unauthorizedSessionPromise;
};

const shouldSuppressApiError = (error: unknown): boolean => {
  if (isAuthRedirectError(error)) return true;
  return getResponseStatus(error) === 401 && useAuthStore.getState().status === 'unauthenticated';
};

const rejectForAuthRedirect = async () => {
  await handleUnauthorizedSession();
  throw createAuthRedirectError();
};

const stableSerialize = (value: unknown): string => {
  if (value === undefined) {
    return 'undefined';
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (value instanceof URLSearchParams) {
    return JSON.stringify(value.toString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  const entries = Object.entries(value as GetDataParams)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
    .join(',')}}`;
};

const hasAbortSignal = (params: GetDataParams): boolean => {
  const signal = params.signal;
  return typeof signal === 'object' && signal !== null && 'aborted' in signal;
};

const buildGetRequestKey = (endpoint: string, params: GetDataParams): string => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId ?? '';
  return `${primaryOrgId}::${endpoint}::${stableSerialize(params)}`;
};

const getResponseStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined;
  }

  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
};

// Axios interceptor to set Authorization using token from your AuthStore session
api.interceptors.request.use(
  async (config) => {
    try {
      const authState = useAuthStore.getState();
      const session = await authState.getValidSession();
      const primaryOrgId = useOrgStore.getState().primaryOrgId;
      if (config.headers) {
        if (session) {
          const token = session.getIdToken().getJwtToken();
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          delete config.headers.Authorization;
        }
        if (primaryOrgId) {
          config.headers['x-org-id'] = primaryOrgId;
        } else {
          delete config.headers['x-org-id'];
        }
      }
      if (!session && !isPublicApiRequest(config)) {
        const status = useAuthStore.getState().status;
        if (status === 'unauthenticated') {
          await rejectForAuthRedirect();
        }
      }
    } catch (error) {
      if (isAuthRedirectError(error)) {
        throw error;
      }
      logger.warn('No valid Cognito session available from AuthStore', error);
    }
    return config;
  },
  (error) => Promise.reject(error instanceof Error ? error : new Error(String(error)))
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetriableAxiosRequestConfig | undefined;

    // Rate-limited — never retry, just propagate immediately
    if (error.response?.status === 429) {
      throw error;
    }

    // If there's no response or it's not 401, just reject
    if (error.response?.status !== 401) {
      throw error;
    }

    if (!originalRequest || originalRequest.skipAuthRedirect) {
      throw error;
    }

    // Avoid infinite loop: only retry once
    if (originalRequest._retry) {
      await handleUnauthorizedSession();
      throw createAuthRedirectError();
    }

    originalRequest._retry = true;

    try {
      const session = await useAuthStore.getState().getValidSession({ forceRefresh: true });
      if (!session) {
        await handleUnauthorizedSession();
        throw createAuthRedirectError();
      }

      // Update auth header and retry the original request
      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: `Bearer ${session.getIdToken().getJwtToken()}`,
      };

      return api(originalRequest);
    } catch (refreshError) {
      if (!isAuthRedirectError(refreshError)) {
        logger.warn('Session refresh failed after 401:', refreshError);
      }
      await handleUnauthorizedSession();
      throw createAuthRedirectError();
    }
  }
);

// GET Request
export const getData = async <T>(
  endpoint: string,
  params: GetDataParams = {},
  opts?: GetDataOptions
): Promise<AxiosResponse<T>> => {
  const requestKey =
    opts?.dedupe === false || hasAbortSignal(params)
      ? undefined
      : buildGetRequestKey(endpoint, params);
  const inFlightRequest =
    requestKey === undefined ? undefined : inFlightGetRequests.get(requestKey);

  try {
    if (inFlightRequest) {
      return (await inFlightRequest) as AxiosResponse<T>;
    }

    const request = api.get<T>(endpoint, { params });

    if (requestKey === undefined) {
      return await request;
    }

    const trackedRequest = request.finally(() => {
      if (inFlightGetRequests.get(requestKey) === trackedRequest) {
        inFlightGetRequests.delete(requestKey);
      }
    });

    inFlightGetRequests.set(requestKey, trackedRequest as Promise<AxiosResponse<unknown>>);
    return await trackedRequest;
  } catch (error: unknown) {
    const status = getResponseStatus(error);
    if (
      !shouldSuppressApiError(error) &&
      (status === undefined || !opts?.suppressStatuses?.includes(status))
    ) {
      logger.error('API getData error:', error);
    }
    throw error;
  }
};

// POST Request
export const postData = async <T, D = unknown>(
  endpoint: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> => {
  try {
    return await api.post<T>(endpoint, data, {
      ...config,
    });
  } catch (error: unknown) {
    if (!shouldSuppressApiError(error)) {
      logger.error('API postData error:', error);
    }
    throw error;
  }
};

// PUT Request
export const putData = async <T, D = unknown>(
  endpoint: string,
  data?: D
): Promise<AxiosResponse<T>> => {
  try {
    return await api.put<T>(endpoint, data);
  } catch (error: unknown) {
    if (!shouldSuppressApiError(error)) {
      logger.error('API putData error:', error);
    }
    throw error;
  }
};

// DELETE Request
export const deleteData = async <T>(
  endpoint: string,
  params: Record<string, unknown> = {}
): Promise<AxiosResponse<T>> => {
  try {
    return await api.delete<T>(endpoint, {
      params,
    });
  } catch (error: unknown) {
    if (!shouldSuppressApiError(error)) {
      logger.error('API deleteData error:', error);
    }
    throw error;
  }
};

export const patchData = async <T, D = unknown>(
  endpoint: string,
  data?: D,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> => {
  try {
    return await api.patch<T>(endpoint, data, {
      ...config,
    });
  } catch (error: unknown) {
    if (!shouldSuppressApiError(error)) {
      logger.error('API patchData error:', error);
    }
    throw error;
  }
};

export default api;
