import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProperty, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsIn, ValidateIf } from 'class-validator';
import { Public } from '../../../auth/auth.decorators';
import { ApiErrorDto } from '../../../documentation/response.dto';
import { leagueInput, PageDto } from '../leagues.dto';
import { ReportsService, reportCategories, type ReportCategory } from './reports.service';

const uuid = { type: 'string', format: 'uuid' } as const;
const nullableUuid = { ...uuid, nullable: true } as const;

class PlayerReportQuery extends PageDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(reportCategories)
  category?: ReportCategory;
}

class ReportTournament {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) timezone!: string;
}

class ReportTeam {
  @ApiProperty(uuid) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String, nullable: true }) logo!: string | null;
}

class ReportPage {
  @ApiProperty({ type: () => ReportTournament }) tournament!: ReportTournament;
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number, example: 20 }) pageSize!: number;
}

class ResultInnings {
  @ApiProperty({ type: Number }) number!: number;
  @ApiProperty(uuid) battingTeamId!: string;
  @ApiProperty({ type: Number }) runs!: number;
  @ApiProperty({ type: Number }) wickets!: number;
  @ApiProperty({ type: Number }) legalBalls!: number;
}

class OfficialResult {
  @ApiProperty(uuid) fixtureId!: string;
  @ApiProperty({ type: Number }) matchNumber!: number;
  @ApiProperty({ type: String, format: 'date-time' }) date!: string;
  @ApiProperty({ type: String }) venue!: string;
  @ApiProperty({ type: Number }) revision!: number;
  @ApiProperty({ type: String, format: 'date-time' }) publishedAt!: string;
  @ApiProperty({ type: String, enum: ['team_win', 'tie', 'no_result', 'draw'] }) outcome!: string;
  @ApiProperty(nullableUuid) winnerTeamId!: string | null;
  @ApiProperty({ type: String, nullable: true }) summary!: string | null;
  @ApiProperty({ type: () => ReportTeam }) team1!: ReportTeam;
  @ApiProperty({ type: () => ReportTeam }) team2!: ReportTeam;
  @ApiProperty({ type: () => ResultInnings, isArray: true }) innings!: ResultInnings[];
}

class ResultsPage extends ReportPage {
  @ApiProperty({ type: () => OfficialResult, isArray: true }) data!: OfficialResult[];
}

class TeamStanding {
  @ApiProperty({ type: Number }) rank!: number;
  @ApiProperty({ type: () => ReportTeam }) team!: ReportTeam;
  @ApiProperty({ type: Number }) played!: number;
  @ApiProperty({ type: Number }) won!: number;
  @ApiProperty({ type: Number }) lost!: number;
  @ApiProperty({ type: Number }) tied!: number;
  @ApiProperty({ type: Number }) noResult!: number;
  @ApiProperty({ type: Number }) drawn!: number;
  @ApiProperty({ type: Number }) points!: number;
  @ApiProperty({ type: Number, nullable: true, description: 'Rounded to three decimals after ranking.' }) netRunRate!: number | null;
  @ApiProperty({ type: Number }) netRunRateMatches!: number;
}

class StandingsPage extends ReportPage {
  @ApiProperty({ type: () => TeamStanding, isArray: true }) data!: TeamStanding[];
}

class PlayerStanding {
  @ApiProperty({ type: Number }) rank!: number;
  @ApiProperty(uuid) playerId!: string;
  @ApiProperty(uuid) registrationId!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: () => ReportTeam }) team!: ReportTeam;
  @ApiProperty({ type: Number }) matches!: number;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } }) metrics!: Record<string, number>;
  @ApiProperty({ type: Number }) dismissalsInvolved!: number;
  @ApiProperty({ type: Number, nullable: true }) battingAverage!: number | null;
  @ApiProperty({ type: Number, nullable: true }) strikeRate!: number | null;
  @ApiProperty({ type: Number, nullable: true }) economy!: number | null;
}

class PlayerReportsPage extends ReportPage {
  @ApiProperty({ type: String, enum: reportCategories }) category!: ReportCategory;
  @ApiProperty({ type: () => PlayerStanding, isArray: true }) data!: PlayerStanding[];
}

@Public()
@ApiTags('Tournament reports')
@ApiParam({ name: 'tournamentId', schema: uuid })
@ApiQuery({ name: 'page', required: false, type: String, example: '1' })
@ApiResponse({ status: 400, description: 'Invalid tournament ID or query.', type: ApiErrorDto })
@ApiResponse({ status: 404, description: 'Tournament schedule has not been published or does not exist.', type: ApiErrorDto })
@Controller('api/tournaments/:tournamentId/reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Get('results')
  @ApiOperation({ summary: 'List official match results and innings summaries' })
  @ApiResponse({ status: 200, type: ResultsPage })
  results(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query(leagueInput(PageDto)) query: PageDto,
  ) {
    return this.reports.results(tournamentId, Number(query.page ?? 1));
  }

  @Get('standings')
  @ApiOperation({ summary: 'Get team standings ranked by points and cricket net run rate' })
  @ApiResponse({ status: 200, type: StandingsPage })
  standings(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query(leagueInput(PageDto)) query: PageDto,
  ) {
    return this.reports.standings(tournamentId, Number(query.page ?? 1));
  }

  @Get('players')
  @ApiOperation({ summary: 'Get a batting, bowling, or fielding leaderboard' })
  @ApiQuery({ name: 'category', required: false, enum: reportCategories, example: 'batting' })
  @ApiResponse({ status: 200, type: PlayerReportsPage })
  players(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query(leagueInput(PlayerReportQuery)) query: PlayerReportQuery,
  ) {
    return this.reports.players(tournamentId, query.category ?? 'batting', Number(query.page ?? 1));
  }
}
