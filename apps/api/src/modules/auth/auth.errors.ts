import type { ApiErrorCode } from "../../common/types/api-error";

export class AuthFlowError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}
