import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { BigIntSerializerInterceptor } from "./common/interceptors/bigint-serializer.interceptor";
import { RequestLogInterceptor } from "./common/interceptors/request-log.interceptor";
import { SecurityHeadersInterceptor } from "./common/interceptors/security-headers.interceptor";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { appConfig, databaseConfig, secretsConfig, solanaConfig } from "./config/app.config";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AntiAbuseModule } from "./modules/anti-abuse/anti-abuse.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BountiesModule } from "./modules/bounties/bounties.module";
import { RewardsModule } from "./modules/rewards/rewards.module";
import { SolanaModule } from "./modules/solana/solana.module";
import { SubmissionsModule } from "./modules/submissions/submissions.module";
import { UsersModule } from "./modules/users/users.module";
import { VerificationModule } from "./modules/verification/verification.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, solanaConfig, secretsConfig],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    BountiesModule,
    SubmissionsModule,
    VerificationModule,
    RewardsModule,
    AnalyticsModule,
    SolanaModule,
    AntiAbuseModule,
    AuditModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: SecurityHeadersInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RequestLogInterceptor },
    { provide: APP_INTERCEPTOR, useClass: BigIntSerializerInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({ path: "{*splat}", method: RequestMethod.ALL });
  }
}
