import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";

type RequestLog = {
  method?: string;
  url?: string;
  requestId?: string;
};

@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger("Http");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestLog>();
    const response = context.switchToHttp().getResponse<{ statusCode?: number }>();
    const path = (request.url ?? "").split("?")[0] ?? "";
    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          JSON.stringify({
            requestId: request.requestId ?? "unknown",
            method: request.method ?? "UNKNOWN",
            path,
            statusCode: response.statusCode ?? 0,
          }),
        );
      }),
    );
  }
}
