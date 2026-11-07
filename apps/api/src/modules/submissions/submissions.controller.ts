import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CsrfGuard } from "../auth/csrf.guard";
import { SessionGuard } from "../auth/session.guard";
import { asHttpException } from "../bounties/bounty.errors";
import { SubmissionsService } from "./submissions.service";

const idSchema = z.object({ id: z.string().uuid() });
const consentSchema = z.object({ accepted: z.literal(true) });
const answerSchema = z.object({
  answer: z.string().trim().min(1).max(500),
  isCorrect: z.boolean().optional(),
  submittedAt: z.string().optional(),
});

@ApiTags("submissions")
@Controller()
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post("bounties/:id/consent")
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOkResponse({ description: "Stores research consent for the signed-in wallet. Wallet login is not consent." })
  consent(@Req() request: Request, @Param(new ZodValidationPipe(idSchema)) params: z.infer<typeof idSchema>, @Body(new ZodValidationPipe(consentSchema)) _body: z.infer<typeof consentSchema>) {
    return this.run(() => this.submissions.consent(this.userId(request), params.id));
  }

  @Post("bounties/:id/sessions")
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOkResponse({ description: "Starts one solving session. The server sets startedAt. A second start returns the same session." })
  start(@Req() request: Request, @Param(new ZodValidationPipe(idSchema)) params: z.infer<typeof idSchema>) {
    return this.run(() => this.submissions.start(this.userId(request), params.id));
  }

  @Get("sessions/:id")
  @UseGuards(SessionGuard)
  @ApiOkResponse({ description: "Returns the signed-in solver's session. The expected answer is omitted." })
  read(@Req() request: Request, @Param(new ZodValidationPipe(idSchema)) params: z.infer<typeof idSchema>) {
    return this.run(() => this.submissions.read(this.userId(request), params.id));
  }

  @Get("sessions/:id/result")
  @UseGuards(SessionGuard)
  @ApiOkResponse({ description: "Returns the latest server verification result for the signed-in solver." })
  result(@Req() request: Request, @Param(new ZodValidationPipe(idSchema)) params: z.infer<typeof idSchema>) {
    return this.run(async () => {
      const session = await this.submissions.read(this.userId(request), params.id);
      return { status: session.status, attemptsUsed: session.attemptsUsed, remainingAttempts: session.remainingAttempts, latest: session.latest };
    });
  }

  @Post("sessions/:id/submissions")
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOkResponse({ description: "Stores one attempt and returns the server verification result. Client correctness is ignored." })
  submit(
    @Req() request: Request,
    @Param(new ZodValidationPipe(idSchema)) params: z.infer<typeof idSchema>,
    @Body(new ZodValidationPipe(answerSchema)) body: z.infer<typeof answerSchema>,
  ) {
    return this.run(() => this.submissions.submit(this.userId(request), params.id, body.answer));
  }

  @Get("bounties/:id/analytics")
  @UseGuards(SessionGuard)
  @ApiOkResponse({ description: "Returns ADR-009 aggregates for the bounty owner. Solver wallets and individual answers are omitted." })
  analytics(@Req() request: Request, @Param(new ZodValidationPipe(idSchema)) params: z.infer<typeof idSchema>) {
    return this.run(() => this.submissions.analytics(this.userId(request), params.id));
  }

  private userId(request: Request): string {
    const id = request.authUser?.id;
    if (!id) {
      throw new Error("Authenticated request is missing a user.");
    }
    return id;
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      asHttpException(error);
    }
  }
}
