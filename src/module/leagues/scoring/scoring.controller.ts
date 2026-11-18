import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser, Public } from "../../../auth/auth.decorators";
import type { AuthenticatedUser } from "../../../auth/auth.types";
import { ApiErrorDto } from "../../../documentation/response.dto";
import { leagueInput } from "../leagues.dto";
import {
  DeliveryDto,
  PublishResultDto,
  ScoreVersionDto,
  SelectPlayerDto,
  SetLineupsDto,
  StartInningsDto,
} from "./scoring.dto";
import {
  PublishResultResponse,
  ScorecardResponse,
  ScoreVersionResponse,
} from "./scoring.responses";
import { ScoringService } from "./scoring.service";

const uuid = { type: "string", format: "uuid" } as const;

@ApiTags("Cricket scoring")
@ApiBearerAuth("access-token")
@ApiParam({ name: "leagueId", schema: uuid })
@ApiParam({ name: "tournamentId", schema: uuid })
@ApiParam({ name: "fixtureId", schema: uuid })
@ApiResponse({ status: 400, type: ApiErrorDto })
@ApiResponse({ status: 401, type: ApiErrorDto })
@ApiResponse({ status: 403, type: ApiErrorDto })
@ApiResponse({ status: 404, type: ApiErrorDto })
@ApiResponse({ status: 409, type: ApiErrorDto })
@Controller(
  "api/leagues/:leagueId/tournaments/:tournamentId/schedule/fixtures/:fixtureId/scorecard",
)
export class ScoringController {
  constructor(
    @Inject(ScoringService) private readonly service: ScoringService,
  ) {}

  @Get()
  @ApiOperation({ summary: "View staff scoring state and the current version" })
  @ApiResponse({ status: 200, type: ScorecardResponse })
  read(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Param("tournamentId", ParseUUIDPipe) tournamentId: string,
    @Param("fixtureId", ParseUUIDPipe) fixtureId: string,
  ) {
    return this.service.read(tournamentId, fixtureId, {
      userId: user.id,
      leagueId,
    });
  }

  @Put("lineups")
  @HttpCode(200)
  @ApiOperation({ summary: "Set lineups and overs for a published fixture" })
  @ApiBody({ type: SetLineupsDto })
  @ApiResponse({ status: 200, type: ScoreVersionResponse })
  setup(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Param("tournamentId", ParseUUIDPipe) tournamentId: string,
    @Param("fixtureId", ParseUUIDPipe) fixtureId: string,
    @Body(leagueInput(SetLineupsDto)) body: SetLineupsDto,
  ) {
    return this.service.setup(user.id, leagueId, tournamentId, fixtureId, body);
  }

  @Post("innings")
  @HttpCode(200)
  @ApiOperation({ summary: "Start an innings with the opening batters" })
  @ApiBody({ type: StartInningsDto })
  @ApiResponse({ status: 200, type: ScoreVersionResponse })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Param("tournamentId", ParseUUIDPipe) tournamentId: string,
    @Param("fixtureId", ParseUUIDPipe) fixtureId: string,
    @Body(leagueInput(StartInningsDto)) body: StartInningsDto,
  ) {
    const { version, ...selection } = body;
    return this.service.append(
      user.id,
      leagueId,
      tournamentId,
      fixtureId,
      version,
      { kind: "innings", ...selection },
    );
  }

  @Put("bowler")
  @HttpCode(200)
  @ApiOperation({ summary: "Select the next over’s bowler" })
  @ApiBody({ type: SelectPlayerDto })
  @ApiResponse({ status: 200, type: ScoreVersionResponse })
  bowler(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Param("tournamentId", ParseUUIDPipe) tournamentId: string,
    @Param("fixtureId", ParseUUIDPipe) fixtureId: string,
    @Body(leagueInput(SelectPlayerDto)) body: SelectPlayerDto,
  ) {
    return this.service.append(
      user.id,
      leagueId,
      tournamentId,
      fixtureId,
      body.version,
      { kind: "bowler", playerId: body.playerId },
    );
  }

  @Put("batter")
  @HttpCode(200)
  @ApiOperation({ summary: "Select the incoming batter after a wicket" })
  @ApiBody({ type: SelectPlayerDto })
  @ApiResponse({ status: 200, type: ScoreVersionResponse })
  batter(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Param("tournamentId", ParseUUIDPipe) tournamentId: string,
    @Param("fixtureId", ParseUUIDPipe) fixtureId: string,
    @Body(leagueInput(SelectPlayerDto)) body: SelectPlayerDto,
  ) {
    return this.service.append(
      user.id,
      leagueId,
      tournamentId,
      fixtureId,
      body.version,
      { kind: "batter", playerId: body.playerId },
    );
  }

  @Post("deliveries")
  @HttpCode(200)
  @ApiOperation({ summary: "Record a delivery" })
  @ApiBody({ type: DeliveryDto })
  @ApiResponse({ status: 200, type: ScoreVersionResponse })
  delivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Param("tournamentId", ParseUUIDPipe) tournamentId: string,
    @Param("fixtureId", ParseUUIDPipe) fixtureId: string,
    @Body(leagueInput(DeliveryDto)) body: DeliveryDto,
  ) {
    const { version, ...details } = body;
    return this.service.append(
      user.id,
      leagueId,
      tournamentId,
      fixtureId,
      version,
      { kind: "ball", ...details },
    );
  }

  @Post("undo")
  @HttpCode(200)
  @ApiOperation({ summary: "Undo the latest scoring action" })
  @ApiBody({ type: ScoreVersionDto })
  @ApiResponse({ status: 200, type: ScoreVersionResponse })
  undo(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Param("tournamentId", ParseUUIDPipe) tournamentId: string,
    @Param("fixtureId", ParseUUIDPipe) fixtureId: string,
    @Body(leagueInput(ScoreVersionDto)) body: ScoreVersionDto,
  ) {
    return this.service.undo(
      user.id,
      leagueId,
      tournamentId,
      fixtureId,
      body.version,
    );
  }

  @Post("correction")
  @HttpCode(200)
  @ApiOperation({
    summary: "Open a correction while the official score remains public",
  })
  @ApiBody({ type: ScoreVersionDto })
  @ApiResponse({ status: 200, type: ScoreVersionResponse })
  correction(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Param("tournamentId", ParseUUIDPipe) tournamentId: string,
    @Param("fixtureId", ParseUUIDPipe) fixtureId: string,
    @Body(leagueInput(ScoreVersionDto)) body: ScoreVersionDto,
  ) {
    return this.service.openCorrection(
      user.id,
      leagueId,
      tournamentId,
      fixtureId,
      body.version,
    );
  }

  @Post("publish")
  @HttpCode(200)
  @ApiOperation({
    summary: "Publish the official scorecard and result (owner/admin)",
  })
  @ApiBody({ type: PublishResultDto })
  @ApiResponse({ status: 200, type: PublishResultResponse })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Param("tournamentId", ParseUUIDPipe) tournamentId: string,
    @Param("fixtureId", ParseUUIDPipe) fixtureId: string,
    @Body(leagueInput(PublishResultDto)) body: PublishResultDto,
  ) {
    return this.service.publish(
      user.id,
      leagueId,
      tournamentId,
      fixtureId,
      body.version,
      body.outcome === "no_result",
    );
  }
}

@ApiTags("Cricket scoring")
@Controller("api/tournaments/:tournamentId/fixtures/:fixtureId/scorecard")
export class PublicScorecardController {
  constructor(
    @Inject(ScoringService) private readonly service: ScoringService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Read the current live or official scorecard" })
  @ApiParam({ name: "tournamentId", schema: uuid })
  @ApiParam({ name: "fixtureId", schema: uuid })
  @ApiResponse({ status: 200, type: ScorecardResponse })
  @ApiResponse({ status: 404, type: ApiErrorDto })
  read(
    @Param("tournamentId", ParseUUIDPipe) tournamentId: string,
    @Param("fixtureId", ParseUUIDPipe) fixtureId: string,
  ) {
    return this.service.read(tournamentId, fixtureId);
  }
}
