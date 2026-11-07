import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { APP_NAME, healthResponseSchema } from "@solversbounty/shared";

@Controller("health")
export class HealthController {
  @Get()
  @ApiOkResponse({ description: "The API process is running." })
  getHealth() {
    return healthResponseSchema.parse({
      status: "ok",
      service: APP_NAME,
    });
  }
}
