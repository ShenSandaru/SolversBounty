import { HttpException } from "@nestjs/common";

export class BountyFlowError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function asHttpException(error: unknown): never {
  if (error instanceof BountyFlowError) {
    throw new HttpException({ code: error.code, message: error.message }, error.status);
  }
  throw error;
}
