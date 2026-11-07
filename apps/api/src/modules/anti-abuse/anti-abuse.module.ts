import { Module } from "@nestjs/common";
import { InMemoryRateLimit } from "./in-memory-rate-limit";

@Module({
  providers: [InMemoryRateLimit],
  exports: [InMemoryRateLimit],
})
export class AntiAbuseModule {}
