import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);
  const origins = config.getOrThrow<string[]>("app.corsOrigins");
  const bodyLimit = config.getOrThrow<string>("app.jsonBodyLimit");
  app.enableCors({ origin: origins });
  app.useBodyParser("json", { limit: bodyLimit });

  const document = new DocumentBuilder()
    .setTitle("SolversBounty API")
    .setDescription(
      "Infrastructure shell. Authentication, bounties, verification, and payouts are not implemented.",
    )
    .setVersion("0.0.0")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, document));
}
