import { Global, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService, openPrismaClient } from "./database.service";

class DatabaseLifecycle extends DatabaseService implements OnModuleInit, OnModuleDestroy {}

@Global()
@Module({
  providers: [
    {
      provide: DatabaseService,
      useFactory: (config: ConfigService): DatabaseLifecycle =>
        new DatabaseLifecycle(
          { url: config.get<string | null>("database.url") ?? null },
          openPrismaClient,
        ),
      inject: [ConfigService],
    },
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
