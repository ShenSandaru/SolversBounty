import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);
  const origins = config.getOrThrow<string[]>("app.corsOrigins");
  if (origins.length === 0 || origins.some((origin) => origin === "*" || origin.includes("*"))) {
    throw new Error("CORS_ORIGIN must list explicit origins when session cookies are used.");
  }
  const bodyLimit = config.getOrThrow<string>("app.jsonBodyLimit");
  app.enableCors({
    origin: origins,
    credentials: true,
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  });
  app.useBodyParser("json", { limit: bodyLimit });

  const document = new DocumentBuilder()
    .setTitle("SolversBounty API")
    .setDescription(
      "Wallet authentication is available. Bounties, verification, and payouts are not implemented.",
    )
    .setVersion("0.0.0")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, document));
}
