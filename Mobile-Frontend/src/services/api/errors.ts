export interface ApiError {
  message: string;
  status: number;
  code?: string;
}

export class ApiRequestError extends Error implements ApiError {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export function normalizeError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) {
    return error;
  }

  if (isAxiosLikeError(error)) {
    const response = error.response;
    const status = response?.status ?? 0;
    const data = response?.data as Record<string, unknown> | undefined;

    const message =
      (typeof data?.detail === 'string' && data.detail) ||
      (typeof data?.message === 'string' && data.message) ||
      (typeof data?.error === 'string' && data.error) ||
      (error instanceof Error ? error.message : 'An unexpected error occurred');

    const code =
      typeof data?.error_code === 'string' ? data.error_code
      : typeof data?.code === 'string' ? data.code
      : undefined;

    return new ApiRequestError(message, status, code);
  }

  if (error instanceof Error) {
    return new ApiRequestError(error.message, 0);
  }

  return new ApiRequestError('An unexpected error occurred', 0);
}

interface AxiosLikeError {
  response?: {
    status: number;
    data: unknown;
  };
  message?: string;
}

function isAxiosLikeError(value: unknown): value is AxiosLikeError & Error {
  return (
    value !== null &&
    typeof value === 'object' &&
    'isAxiosError' in value &&
    (value as Record<string, unknown>).isAxiosError === true
  );
}
