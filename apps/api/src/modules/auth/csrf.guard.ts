import { CanActivate, ExecutionContext, HttpException, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { CSRF_HEADER } from "./auth.constants";
import { csrfTokensMatch } from "./auth.cookies";

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!csrfTokensMatch(request.header("cookie"), request.header(CSRF_HEADER))) {
      throw new HttpException({ code: "FORBIDDEN", message: "Cross-site request blocked." }, 403);
    }
    return true;
  }
}
