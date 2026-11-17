import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { LeaguesController } from "./leagues.controller";
import { LeaguesService } from "./leagues.service";

@Module({
  imports: [DatabaseModule],
  controllers: [LeaguesController],
  providers: [LeaguesService],
})
export class LeaguesModule {}
