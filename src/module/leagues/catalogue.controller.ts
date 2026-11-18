import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/auth.decorators';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { ApiErrorDto } from '../../documentation/response.dto';
import { CreatePlayerDto, CreateTeamDto, EditPlayerDto, EditTeamDto, RegisterPlayerDto } from './catalogue.dto';
import { CataloguePlayerDto, CataloguePlayerPageDto, CatalogueTeamDto, CatalogueTeamPageDto, RosterPageDto } from './catalogue.responses';
import { CatalogueService } from './catalogue.service';
import { leagueInput, PageDto } from './leagues.dto';

const uuid = { type: 'string', format: 'uuid' } as const;
const tournament = 'tournaments/:tournamentId';

@ApiTags('Teams and rosters')
@ApiBearerAuth('access-token')
@ApiParam({ name: 'leagueId', schema: uuid })
@ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorDto })
@ApiResponse({ status: 401, description: 'Login required.', type: ApiErrorDto })
@ApiResponse({ status: 403, description: 'Insufficient league permissions.', type: ApiErrorDto })
@ApiResponse({ status: 404, description: 'Resource not found or inaccessible.', type: ApiErrorDto })
@ApiResponse({ status: 409, description: 'Duplicate profile or conflicting tournament state.', type: ApiErrorDto })
@Controller('api/leagues/:leagueId')
export class CatalogueController {
  constructor(@Inject(CatalogueService) private readonly catalogue: CatalogueService) {}

  @Get('teams')
  @ApiOperation({ summary: 'List league teams' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiResponse({ status: 200, type: CatalogueTeamPageDto })
  listTeams(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Query(leagueInput(PageDto)) query: PageDto,
  ) {
    return this.catalogue.listTeams(user.id, leagueId, Number(query.page ?? 1));
  }

  @Post('teams')
  @ApiOperation({ summary: 'Create a league team' })
  @ApiBody({ type: CreateTeamDto })
  @ApiResponse({ status: 201, type: CatalogueTeamDto })
  createTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Body(leagueInput(CreateTeamDto)) body: CreateTeamDto,
  ) {
    return this.catalogue.createTeam(user.id, leagueId, body);
  }

  @Patch('teams/:teamId')
  @ApiOperation({ summary: 'Edit a league team' })
  @ApiParam({ name: 'teamId', schema: uuid })
  @ApiBody({ type: EditTeamDto })
  @ApiResponse({ status: 200, type: CatalogueTeamDto })
  editTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body(leagueInput(EditTeamDto)) body: EditTeamDto,
  ) {
    return this.catalogue.editTeam(user.id, leagueId, teamId, body);
  }

  @Delete('teams/:teamId')
  @ApiOperation({ summary: 'Remove an unused league team' })
  @ApiParam({ name: 'teamId', schema: uuid })
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Completed without a response body.' })
  removeTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ) {
    return this.catalogue.removeTeam(user.id, leagueId, teamId);
  }

  @Get('players')
  @ApiOperation({ summary: 'List league player profiles' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiResponse({ status: 200, type: CataloguePlayerPageDto })
  listPlayers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Query(leagueInput(PageDto)) query: PageDto,
  ) {
    return this.catalogue.listPlayers(user.id, leagueId, Number(query.page ?? 1));
  }

  @Post('players')
  @ApiOperation({ summary: 'Create a league player profile' })
  @ApiBody({ type: CreatePlayerDto })
  @ApiResponse({ status: 201, type: CataloguePlayerDto })
  createPlayer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Body(leagueInput(CreatePlayerDto)) body: CreatePlayerDto,
  ) {
    return this.catalogue.createPlayer(user.id, leagueId, body);
  }

  @Patch('players/:playerId')
  @ApiOperation({ summary: 'Edit a league player profile' })
  @ApiParam({ name: 'playerId', schema: uuid })
  @ApiBody({ type: EditPlayerDto })
  @ApiResponse({ status: 200, type: CataloguePlayerDto })
  editPlayer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @Body(leagueInput(EditPlayerDto)) body: EditPlayerDto,
  ) {
    return this.catalogue.editPlayer(user.id, leagueId, playerId, body);
  }

  @Delete('players/:playerId')
  @ApiOperation({ summary: 'Remove an unused player profile' })
  @ApiParam({ name: 'playerId', schema: uuid })
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Completed without a response body.' })
  removePlayer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ) {
    return this.catalogue.removePlayer(user.id, leagueId, playerId);
  }

  @Get(`${tournament}/teams`)
  @ApiOperation({ summary: 'List enrolled tournament teams' })
  @ApiParam({ name: 'tournamentId', schema: uuid })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiResponse({ status: 200, type: CatalogueTeamPageDto })
  listTournamentTeams(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query(leagueInput(PageDto)) query: PageDto,
  ) {
    return this.catalogue.listTournamentTeams(user.id, leagueId, tournamentId, Number(query.page ?? 1));
  }

  @Put(`${tournament}/teams/:teamId`)
  @ApiOperation({ summary: 'Enroll a league team in a draft tournament' })
  @ApiParam({ name: 'tournamentId', schema: uuid })
  @ApiParam({ name: 'teamId', schema: uuid })
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Completed without a response body.' })
  enrollTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ) {
    return this.catalogue.enrollTeam(user.id, leagueId, tournamentId, teamId);
  }

  @Delete(`${tournament}/teams/:teamId`)
  @ApiOperation({ summary: 'Remove an unused tournament team' })
  @ApiParam({ name: 'tournamentId', schema: uuid })
  @ApiParam({ name: 'teamId', schema: uuid })
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Completed without a response body.' })
  unenrollTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ) {
    return this.catalogue.unenrollTeam(user.id, leagueId, tournamentId, teamId);
  }

  @Get(`${tournament}/players`)
  @ApiOperation({ summary: 'List tournament player registrations' })
  @ApiParam({ name: 'tournamentId', schema: uuid })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiResponse({ status: 200, type: RosterPageDto })
  listRoster(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query(leagueInput(PageDto)) query: PageDto,
  ) {
    return this.catalogue.listRoster(user.id, leagueId, tournamentId, Number(query.page ?? 1));
  }

  @Put(`${tournament}/players/:playerId`)
  @ApiOperation({ summary: 'Register a player or edit their draft assignment' })
  @ApiParam({ name: 'tournamentId', schema: uuid })
  @ApiParam({ name: 'playerId', schema: uuid })
  @ApiBody({ type: RegisterPlayerDto })
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Completed without a response body.' })
  registerPlayer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
    @Body(leagueInput(RegisterPlayerDto)) body: RegisterPlayerDto,
  ) {
    return this.catalogue.registerPlayer(user.id, leagueId, tournamentId, playerId, body);
  }

  @Delete(`${tournament}/players/:playerId`)
  @ApiOperation({ summary: 'Remove a draft registration without match history' })
  @ApiParam({ name: 'tournamentId', schema: uuid })
  @ApiParam({ name: 'playerId', schema: uuid })
  @HttpCode(204)
  @ApiResponse({ status: 204, description: 'Completed without a response body.' })
  unregisterPlayer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ) {
    return this.catalogue.unregisterPlayer(user.id, leagueId, tournamentId, playerId);
  }
}
