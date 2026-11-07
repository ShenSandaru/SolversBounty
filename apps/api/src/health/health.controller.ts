import { Controller, Get, Res } from "@nestjs/common";
import { ApiOkResponse, ApiServiceUnavailableResponse } from "@nestjs/swagger";
import { APP_NAME, healthResponseSchema } from "@solversbounty/shared";
import type { Response } from "express";
import { DatabaseService } from "../database/database.service";
import { readinessResult } from "./readiness";

@Controller("health")
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @ApiOkResponse({ description: "The API process is running. This does not check product workflows." })
  getHealth() {
    return healthResponseSchema.parse({
      status: "ok",
      service: APP_NAME,
    });
  }

  @Get("ready")
  @ApiOkResponse({ description: "Required dependencies that are configured are reachable." })
  @ApiServiceUnavailableResponse({ description: "A configured dependency is unavailable." })
  getReady(@Res({ passthrough: true }) response: Response) {
    const result = readinessResult(this.database.status);
    response.status(result.statusCode);
    return result.body;
  }
}
