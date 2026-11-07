import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";
import { redactSecrets } from "../logging/redact";
import { codeForStatus, type ApiErrorBody } from "../types/api-error";

type RequestWithId = {
  requestId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<RequestWithId>();
    const requestId = request.requestId ?? "unknown";

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const record = isRecord(raw) ? raw : undefined;
      const message = redactSecrets(readMessage(raw, exception.message));
      const body: ApiErrorBody = {
        statusCode: status,
        code: codeForStatus(status, record?.code),
        message,
        requestId,
      };
      if (Array.isArray(record?.issues)) {
        body.issues = record.issues.flatMap(readIssue);
      }
      if (isRecord(record?.checks)) {
        body.checks = Object.fromEntries(
          Object.entries(record.checks).flatMap(([key, value]) =>
            typeof value === "string" ? [[key, value]] : [],
          ),
        );
      }
      response.status(status).json(body);
      return;
    }

    this.logger.error(exception instanceof Error ? exception.name : "UnhandledException");
    const body: ApiErrorBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL",
      message: "Internal server error",
      requestId,
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}

function readMessage(raw: unknown, fallback: string): string {
  if (typeof raw === "string") {
    return raw;
  }
  if (isRecord(raw) && typeof raw.message === "string") {
    return raw.message;
  }
  if (isRecord(raw) && Array.isArray(raw.message) && typeof raw.message[0] === "string") {
    return raw.message[0];
  }
  return fallback;
}

function readIssue(value: unknown): { path: string; message: string }[] {
  if (!isRecord(value) || typeof value.message !== "string") {
    return [];
  }
  const path = Array.isArray(value.path) ? value.path.map(String).join(".") : "";
  return [{ path, message: value.message }];
}
