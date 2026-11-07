import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CsrfGuard } from "../auth/csrf.guard";
import { SessionGuard } from "../auth/session.guard";
import { asHttpException } from "./bounty.errors";
import { BountiesService } from "./bounties.service";
import { FundingService } from "./funding.service";

const idSchema = z.object({ id: z.string().uuid() });
const signatureSchema = z.object({ signature: z.string().min(64).max(88) });

@ApiTags("bounties")
@Controller("bounties")
export class BountiesController {
  constructor(
    private readonly bounties: BountiesService,
    private readonly funding: FundingService,
  ) {}

  @Post()
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOkResponse({ description: "Creates a draft bounty for the authenticated wallet. The answer is stored encrypted." })
  create(@Req() request: Request, @Body() body: unknown) {
    return this.run(() => this.bounties.create(this.creatorId(request), body));
  }

  @Get()
  @ApiOkResponse({ description: "Lists active bounties. Drafts are omitted. Expected answers are omitted." })
  active() {
    return this.run(() => this.bounties.active());
  }

  @Get("mine")
  @UseGuards(SessionGuard)
  @ApiOkResponse({ description: "Lists bounties owned by the authenticated creator, including the decrypted answer." })
  mine(@Req() request: Request) {
    return this.run(() => this.bounties.mine(this.creatorId(request)));
  }

  @Get(":id")
  @UseGuards(SessionGuard)
  @ApiOkResponse({ description: "Returns one bounty to its creator. Another creator receives not found." })
  owned(@Req() request: Request, @Param(new ZodValidationPipe(idSchema)) params: z.infer<typeof idSchema>) {
    return this.run(() => this.bounties.owned(this.creatorId(request), params.id));
  }

  @Patch(":id")
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOkResponse({ description: "Updates a draft owned by the authenticated creator." })
  update(
    @Req() request: Request,
    @Param(new ZodValidationPipe(idSchema)) params: z.infer<typeof idSchema>,
    @Body() body: unknown,
  ) {
    return this.run(() => this.bounties.update(this.creatorId(request), params.id, body));
  }

  @Get(":id/funding")
  @UseGuards(SessionGuard)
  @ApiOkResponse({ description: "Returns the custodial Devnet treasury address and the two funding obligations. Drafts stay out of the public list." })
  fundingRequirements(@Req() request: Request, @Param(new ZodValidationPipe(idSchema)) params: z.infer<typeof idSchema>) {
    return this.run(() => this.funding.requirements(this.creatorId(request), params.id));
  }

  @Post(":id/funding/:purpose")
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOkResponse({ description: "Verifies one creator-signed Devnet transfer. The reward pool and the 5% commission are separate signatures." })
  submitFunding(
    @Req() request: Request,
    @Param(new ZodValidationPipe(idSchema.extend({ purpose: z.enum(["reward-pool", "commission"]) }))) params: { id: string; purpose: "reward-pool" | "commission" },
    @Body(new ZodValidationPipe(signatureSchema)) body: z.infer<typeof signatureSchema>,
  ) {
    const purpose = params.purpose === "reward-pool" ? "reward_pool" : "commission";
    return this.run(() => this.funding.submit(this.creatorId(request), this.wallet(request), params.id, purpose, body.signature));
  }

  @Post(":id/activate")
  @UseGuards(SessionGuard, CsrfGuard)
  @ApiOkResponse({ description: "Refuses activation until reward-pool and commission funding are verified." })
  activate(@Req() request: Request, @Param(new ZodValidationPipe(idSchema)) params: z.infer<typeof idSchema>) {
    return this.run(() => this.bounties.activate(this.creatorId(request), params.id));
  }

  private creatorId(request: Request): string {
    const id = request.authUser?.id;
    if (!id) {
      throw new Error("Authenticated request is missing a user.");
    }
    return id;
  }

  private wallet(request: Request): string {
    const wallet = request.authUser?.walletAddress;
    if (!wallet) {
      throw new Error("Authenticated request is missing a wallet.");
    }
    return wallet;
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      asHttpException(error);
    }
  }
}
