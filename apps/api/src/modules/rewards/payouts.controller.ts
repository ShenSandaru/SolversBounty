import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CsrfGuard } from "../auth/csrf.guard";
import { SessionGuard } from "../auth/session.guard";
import { asHttpException, BountyFlowError } from "../bounties/bounty.errors";
import { PrismaPayoutRepository } from "./prisma-payout.repository";
import { PayoutWorker } from "./payout-worker";

const idSchema = z.object({ id: z.string().uuid() });

@ApiTags("payouts")
@Controller()
export class PayoutsController {
  constructor(
    private readonly store: PrismaPayoutRepository,
    private readonly worker: PayoutWorker,
  ) {}

  @Get("payouts/mine")
  @UseGuards(SessionGuard)
  @ApiOkResponse({ description: "Returns the signed-in solver's payout statuses. Other solvers' rows are omitted." })
  mine(@Req() request: Request) {
    return this.perform(() => this.store.solverPayouts(this.userId(request)));
  }

  @Get("bounties/:id/payouts")
  @UseGuards(SessionGuard)
  @ApiOkResponse({ description: "Returns aggregated payout counts and ledger buckets for the bounty owner. Solver wallets are omitted." })
  creator(@Req() request: Request, @Param(new ZodValidationPipe(idSchema)) params: z.infer<typeof idSchema>) {
    return this.perform(async () => {
      const summary = await this.store.creatorSummary(params.id, this.userId(request));
      if (summary === "missing") {
        throw new BountyFlowError(404, "NOT_FOUND", "Bounty not found.");
      }
      return summary;
    });
  }

  @Get("admin/payouts")
  @UseGuards(SessionGuard)
  @ApiOkResponse({ description: "Operational payout list for an administrator. This is not a research analytics response." })
  adminList(@Req() request: Request) {
    this.requireAdmin(request);
    return this.perform(() => this.store.adminPayouts());
  }

  @Post("admin/payouts/run")
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOkResponse({ description: "Runs one payout batch. Ordinary users cannot call it." })
  run(@Req() request: Request) {
    this.requireAdmin(request);
    return this.perform(async () => {
      await this.worker.nudge();
      return { processed: true };
    });
  }

  private requireAdmin(request: Request): void {
    if (request.authUser?.role !== "admin") {
      throw new BountyFlowError(403, "FORBIDDEN", "Administrator access is required.");
    }
  }

  private userId(request: Request): string {
    const id = request.authUser?.id;
    if (!id) {
      throw new Error("Authenticated request is missing a user.");
    }
    return id;
  }

  private async perform<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      asHttpException(error);
    }
  }
}
