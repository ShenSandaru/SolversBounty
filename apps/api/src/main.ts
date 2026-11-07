import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { resolveSolanaRpcUrl } from "./config/solana-env";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: "http://localhost:3000" });

  const config = new DocumentBuilder()
    .setTitle("SolversBounty API")
    .setDescription("Hackathon API shell. Product routes are not implemented.")
    .setVersion("0.0.0")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  Logger.log(`Listening on ${port}. Devnet RPC ${resolveSolanaRpcUrl()}`, "Bootstrap");
}

void bootstrap();
