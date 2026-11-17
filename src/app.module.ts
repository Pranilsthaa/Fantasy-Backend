import { LeaguesModule } from './module/leagues/leagues.module';
import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { MatchesModule } from "./module/matches/matches.module";
import { PlayersModule } from "./module/players/players.module";
import { LoggerMiddleware } from "./utils/logger";

@Module({
  imports: [LeaguesModule, AuthModule, DatabaseModule, PlayersModule, MatchesModule],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
