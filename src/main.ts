import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import "reflect-metadata";
import { AppModule } from "./app.module";
import "./database/environment";
import { setupApiDocumentation } from "./documentation/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  setupApiDocumentation(app);
  await app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0");
  Logger.log(`Server is running on ${await app.getUrl()}`, "Bootstrap");
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start application:", error);
  process.exitCode = 1;
});
