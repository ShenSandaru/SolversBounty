import { Module } from "@nestjs/common";
import { AntiAbuseModule } from "../anti-abuse/anti-abuse.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PrismaAuthRepository } from "./prisma-auth.repository";
import { SessionGuard } from "./session.guard";
import { CsrfGuard } from "./csrf.guard";

@Module({
  imports: [AntiAbuseModule],
  controllers: [AuthController],
  providers: [PrismaAuthRepository, AuthService, SessionGuard, CsrfGuard],
  exports: [AuthService, SessionGuard, CsrfGuard],
})
export class AuthModule {}
