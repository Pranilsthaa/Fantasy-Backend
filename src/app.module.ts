import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { PlayersModule } from './module/players/players.module';
import { MatchesModule } from './module/matches/matches.module';
import { LoggerMiddleware } from './utils/logger';

@Module({
  imports: [AuthModule, DatabaseModule, PlayersModule, MatchesModule],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
