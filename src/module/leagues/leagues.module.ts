import { ReportsController } from "./reports/reports.controller";
import { ReportsService } from "./reports/reports.service";
import { PublicScorecardController, ScoringController } from "./scoring/scoring.controller";
import { ScoringService } from "./scoring/scoring.service";
import { PublicScheduleController, ScheduleController } from "./schedule.controller";
import { ScheduleService } from "./schedule.service";
import { CatalogueController } from "./catalogue.controller";
import { CatalogueService } from "./catalogue.service";
import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { LeaguesController } from "./leagues.controller";
import { LeaguesService } from "./leagues.service";

@Module({
  imports: [DatabaseModule],
  controllers: [LeaguesController, CatalogueController, ScheduleController, PublicScheduleController, ScoringController, PublicScorecardController, ReportsController],
  providers: [LeaguesService, CatalogueService, ScheduleService, ScoringService, ReportsService],
})
export class LeaguesModule {}
