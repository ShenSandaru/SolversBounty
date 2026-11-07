import { Body, Controller, Get, Headers, HttpException, Post, Res } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthFlowError } from "./auth.errors";
import { AuthService } from "./auth.service";

const walletSchema = z.object({
  walletAddress: z.string().min(32).max(44),
});

const loginSchema = walletSchema.extend({
  signature: z.string().min(1).max(128),
});

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("nonce")
  @ApiOkResponse({ description: "Issues one active login nonce and the exact message to sign." })
  issueNonce(@Body(new ZodValidationPipe(walletSchema)) body: z.infer<typeof walletSchema>) {
    return this.run(() => this.auth.issueNonce(body.walletAddress));
  }

  @Post("login")
  @ApiOkResponse({ description: "Verifies the wallet signature and sets an HttpOnly session cookie." })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.run(() => this.auth.login(body.walletAddress, body.signature));
    response.setHeader("Set-Cookie", result.setCookie);
    return { walletAddress: result.user.walletAddress, role: result.user.role };
  }

  @Get("session")
  @ApiOkResponse({ description: "Returns the wallet bound to the session cookie." })
  session(@Headers("cookie") cookie?: string) {
    return this.run(() => this.auth.sessionFromCookie(cookie));
  }

  @Post("logout")
  @ApiOkResponse({ description: "Revokes the server session. This sends no Solana transaction." })
  async logout(@Headers("cookie") cookie: string | undefined, @Res({ passthrough: true }) response: Response) {
    const clear = await this.run(() => this.auth.logout(cookie));
    response.setHeader("Set-Cookie", clear);
    return { revoked: true };
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof AuthFlowError) {
        throw new HttpException({ code: error.code, message: error.message }, error.status);
      }
      throw error;
    }
  }
}
