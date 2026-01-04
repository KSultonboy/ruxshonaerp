import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ API prefix
  app.setGlobalPrefix("api");

  // ✅ CORS (prod’da domen bilan)
  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
    credentials: true,
  });

  // ✅ DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`API running on http://0.0.0.0:${port}/api`);
}

bootstrap();
