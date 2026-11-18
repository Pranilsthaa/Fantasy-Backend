import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../../auth/auth.decorators";
import type { AuthenticatedUser } from "../../auth/auth.types";
import { ApiErrorDto } from "../../documentation/response.dto";
import {
  CreateLeagueDto,
  CreateTournamentDto,
  leagueInput,
  PageDto,
  SetStaffDto,
  UpdateLeagueDto,
  UpdateTournamentDto,
} from "./leagues.dto";
import {
  LeagueListDto,
  LeagueResponseDto,
  StaffListDto,
  StaffResponseDto,
  TournamentListDto,
  TournamentResponseDto,
} from "./leagues.responses";
import { LeaguesService } from "./leagues.service";

@ApiTags("Leagues and tournaments")
@ApiBearerAuth("access-token")
@ApiResponse({ status: 400, description: "Invalid input.", type: ApiErrorDto })
@ApiResponse({ status: 401, description: "Login required.", type: ApiErrorDto })
@ApiResponse({
  status: 403,
  description: "Insufficient league permissions.",
  type: ApiErrorDto,
})
@ApiResponse({
  status: 404,
  description: "Resource not found or league inaccessible.",
  type: ApiErrorDto,
})
@Controller("api/leagues")
export class LeaguesController {
  constructor(
    @Inject(LeaguesService) private readonly service: LeaguesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create a cricket league",
    description:
      "Any logged-in user may create a league and becomes its owner. Slug and sport are server-controlled.",
  })
  @ApiBody({ type: CreateLeagueDto })
  @ApiResponse({ status: 201, type: LeagueResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(leagueInput(CreateLeagueDto)) body: CreateLeagueDto,
  ) {
    return this.service.create(user.id, body);
  }

  @Get()
  @ApiOperation({
    summary: "My leagues",
    description:
      "Includes owned leagues and active admin/scorer memberships. Each item includes the signed-in user’s viewerRole for that league.",
  })
  @ApiQuery({ name: "page", required: false, type: String, example: "1" })
  @ApiResponse({ status: 200, type: LeagueListDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(leagueInput(PageDto)) query: PageDto,
  ) {
    return this.service.list(user.id, Number(query.page ?? 1));
  }

  @Get(":leagueId")
  @ApiParam({ name: "leagueId", schema: { type: "string", format: "uuid" } })
  @ApiOperation({ summary: "Get league details" })
  @ApiResponse({ status: 200, type: LeagueResponseDto })
  details(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
  ) {
    return this.service.details(user.id, leagueId);
  }

  @Patch(":leagueId")
  @ApiParam({ name: "leagueId", schema: { type: "string", format: "uuid" } })
  @ApiOperation({ summary: "Edit league details (owner only)" })
  @ApiBody({ type: UpdateLeagueDto })
  @ApiResponse({ status: 200, type: LeagueResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Body(leagueInput(UpdateLeagueDto)) body: UpdateLeagueDto,
  ) {
    return this.service.update(user.id, leagueId, body);
  }

  @Get(":leagueId/staff")
  @ApiParam({ name: "leagueId", schema: { type: "string", format: "uuid" } })
  @ApiOperation({ summary: "List active staff (owner only)" })
  @ApiQuery({ name: "page", required: false, type: String, example: "1" })
  @ApiResponse({ status: 200, type: StaffListDto })
  staff(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Query(leagueInput(PageDto)) query: PageDto,
  ) {
    return this.service.staff(user.id, leagueId, Number(query.page ?? 1));
  }

  @Put(":leagueId/staff")
  @ApiParam({ name: "leagueId", schema: { type: "string", format: "uuid" } })
  @ApiOperation({
    summary: "Assign or change staff role (owner only)",
    description:
      "Select an existing user by username. Also reactivates previously removed staff.",
  })
  @ApiBody({ type: SetStaffDto })
  @ApiResponse({ status: 200, type: StaffResponseDto })
  setStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Body(leagueInput(SetStaffDto)) body: SetStaffDto,
  ) {
    return this.service.setStaff(user.id, leagueId, body);
  }

  @Delete(":leagueId/staff/:userId")
  @ApiParam({ name: "leagueId", schema: { type: "string", format: "uuid" } })
  @ApiParam({ name: "userId", schema: { type: "string", format: "uuid" } })
  @HttpCode(204)
  @ApiOperation({ summary: "Remove staff access (owner only)" })
  @ApiResponse({
    status: 204,
    description: "Membership deactivated. Repeating is safe.",
  })
  removeStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
  ) {
    return this.service.removeStaff(user.id, leagueId, userId);
  }

  @Post(":leagueId/tournaments")
  @ApiParam({ name: "leagueId", schema: { type: "string", format: "uuid" } })
  @ApiOperation({ summary: "Create a draft tournament (owner/admin)" })
  @ApiBody({ type: CreateTournamentDto })
  @ApiResponse({ status: 201, type: TournamentResponseDto })
  @ApiResponse({
    status: 409,
    description: "Season already exists in this league.",
    type: ApiErrorDto,
  })
  createTournament(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Body(leagueInput(CreateTournamentDto)) body: CreateTournamentDto,
  ) {
    return this.service.createTournament(user.id, leagueId, body);
  }

  @Get(":leagueId/tournaments")
  @ApiParam({ name: "leagueId", schema: { type: "string", format: "uuid" } })
  @ApiOperation({ summary: "List tournament editions" })
  @ApiQuery({ name: "page", required: false, type: String, example: "1" })
  @ApiResponse({ status: 200, type: TournamentListDto })
  listTournaments(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Query(leagueInput(PageDto)) query: PageDto,
  ) {
    return this.service.listTournaments(
      user.id,
      leagueId,
      Number(query.page ?? 1),
    );
  }

  @Get(":leagueId/tournaments/:tournamentId")
  @ApiParam({ name: "leagueId", schema: { type: "string", format: "uuid" } })
  @ApiParam({
    name: "tournamentId",
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Get tournament details" })
  @ApiResponse({ status: 200, type: TournamentResponseDto })
  tournament(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Param("tournamentId", ParseUUIDPipe) tournamentId: string,
  ) {
    return this.service.tournament(user.id, leagueId, tournamentId);
  }

  @Patch(":leagueId/tournaments/:tournamentId")
  @ApiParam({ name: "leagueId", schema: { type: "string", format: "uuid" } })
  @ApiParam({
    name: "tournamentId",
    schema: { type: "string", format: "uuid" },
  })
  @ApiOperation({ summary: "Edit a draft tournament (owner/admin)" })
  @ApiBody({ type: UpdateTournamentDto })
  @ApiResponse({ status: 200, type: TournamentResponseDto })
  @ApiResponse({
    status: 409,
    description: "Season conflicts or tournament is no longer a draft.",
    type: ApiErrorDto,
  })
  updateTournament(
    @CurrentUser() user: AuthenticatedUser,
    @Param("leagueId", ParseUUIDPipe) leagueId: string,
    @Param("tournamentId", ParseUUIDPipe) tournamentId: string,
    @Body(leagueInput(UpdateTournamentDto)) body: UpdateTournamentDto,
  ) {
    return this.service.updateTournament(user.id, leagueId, tournamentId, body);
  }
}
