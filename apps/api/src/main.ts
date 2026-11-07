import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { configureApp } from "./bootstrap";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureApp(app);
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>("app.port");
  const rpcUrl = config.getOrThrow<string>("solana.rpcUrl");
  const origins = config.getOrThrow<string[]>("app.corsOrigins");
  await app.listen(port);
  Logger.log(`Listening on ${port}. Devnet RPC ${rpcUrl}. CORS ${origins.join(", ")}`, "Bootstrap");
}

void bootstrap();
