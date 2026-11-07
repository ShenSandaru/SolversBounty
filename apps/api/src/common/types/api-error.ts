export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "AUTH_REJECTED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "NOT_READY",
  "INTERNAL",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiErrorBody = {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  requestId: string;
  issues?: { path: string; message: string }[];
  checks?: Record<string, string>;
};

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && API_ERROR_CODES.some((code) => code === value);
}

export function codeForStatus(status: number, explicit: unknown): ApiErrorCode {
  if (isApiErrorCode(explicit)) {
    return explicit;
  }
  switch (status) {
    case 400:
      return "VALIDATION_ERROR";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    case 503:
      return "NOT_READY";
    default:
      return "INTERNAL";
  }
}
