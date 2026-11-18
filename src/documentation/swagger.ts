import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupApiDocumentation(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Local Fantasy API")
    .setDescription(
      "Cricket-first fantasy platform for local leagues. Public endpoints provide player lists, fixtures and health checks. " +
        "Register or log in under Authentication, copy the accessToken, and use Authorize to call protected endpoints. " +
        "Access JWTs last up to 15 minutes. Refresh credentials rotate and sessions expire after seven days. " +
        "Logout requires the latest refresh credential. Auth endpoints are rate limited. " +
        "Only implemented endpoints are documented; league, team, roster, schedule, cricket scoring and tournament reports are available; fantasy scoring APIs are future work.",
    )
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Paste the accessToken returned by registration or login, without the Bearer prefix. Refresh tokens are not access JWTs.",
      },
      "access-token",
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  for (const name of [
    "RegisterDto",
    "LoginDto",
    "RefreshTokenDto",
    "CreateLeagueDto",
    "UpdateLeagueDto",
    "SetStaffDto",
    "CreateTournamentDto",
    "UpdateTournamentDto",
    "CreateTeamDto",
    "EditTeamDto",
    "CreatePlayerDto",
    "EditPlayerDto",
    "RegisterPlayerDto",
    "CreateFixtureDto",
    "EditFixtureDto",
    "FixtureStatusDto",
    "SetLineupsDto",
    "ScoreVersionDto",
    "StartInningsDto",
    "SelectPlayerDto",
    "DeliveryDto",
    "PublishResultDto",
  ]) {
    const schema = document.components?.schemas?.[name];
    if (schema && !("$ref" in schema)) schema.additionalProperties = false;
  }
  SwaggerModule.setup("api/docs", app, document, {
    jsonDocumentUrl: "/api/docs-json",
    raw: ["json"],
    customSiteTitle: "Local Fantasy API Documentation",
    swaggerOptions: {
      persistAuthorization: false,
      displayRequestDuration: true,
    },
  });
  return document;
}
