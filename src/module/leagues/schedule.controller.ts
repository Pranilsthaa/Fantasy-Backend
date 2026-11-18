import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../auth/auth.decorators';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { ApiErrorDto } from '../../documentation/response.dto';
import { leagueInput, PageDto } from './leagues.dto';
import { CreateFixtureDto, EditFixtureDto, FixtureStatusDto, PublishedScheduleDto, ScheduleDto } from './schedule.dto';
import { ScheduleService } from './schedule.service';

const uuid = { type: 'string', format: 'uuid' } as const;

@ApiTags('Tournament schedules')
@ApiBearerAuth('access-token')
@ApiParam({ name: 'leagueId', schema: uuid })
@ApiParam({ name: 'tournamentId', schema: uuid })
@ApiResponse({ status: 400, type: ApiErrorDto })
@ApiResponse({ status: 401, type: ApiErrorDto })
@ApiResponse({ status: 403, type: ApiErrorDto })
@ApiResponse({ status: 404, type: ApiErrorDto })
@ApiResponse({ status: 409, type: ApiErrorDto })
@Controller('api/leagues/:leagueId/tournaments/:tournamentId/schedule')
export class ScheduleController {
  constructor(@Inject(ScheduleService) private readonly schedules: ScheduleService) {}

  @Get()
  @ApiOperation({ summary: 'Read the tournament schedule as league staff' })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiResponse({ status: 200, type: ScheduleDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query(leagueInput(PageDto)) query: PageDto,
  ) {
    return this.schedules.staffList(user.id, leagueId, tournamentId, Number(query.page ?? 1));
  }

  @Post('fixtures')
  @ApiOperation({ summary: 'Create a fixture between two enrolled teams' })
  @ApiBody({ type: CreateFixtureDto })
  @ApiResponse({ status: 201, schema: { type: 'object', required: ['id'], properties: { id: uuid } } })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Body(leagueInput(CreateFixtureDto)) body: CreateFixtureDto,
  ) {
    return this.schedules.create(user.id, leagueId, tournamentId, body);
  }

  @Patch('fixtures/:fixtureId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Edit or reschedule an upcoming fixture' })
  @ApiParam({ name: 'fixtureId', schema: uuid })
  @ApiBody({ type: EditFixtureDto })
  @ApiResponse({ status: 204 })
  edit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('fixtureId', ParseUUIDPipe) fixtureId: string,
    @Body(leagueInput(EditFixtureDto)) body: EditFixtureDto,
  ) {
    return this.schedules.edit(user.id, leagueId, tournamentId, fixtureId, body);
  }

  @Delete('fixtures/:fixtureId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an upcoming fixture from an unpublished schedule' })
  @ApiParam({ name: 'fixtureId', schema: uuid })
  @ApiResponse({ status: 204 })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('fixtureId', ParseUUIDPipe) fixtureId: string,
  ) {
    return this.schedules.remove(user.id, leagueId, tournamentId, fixtureId);
  }

  @Put('publish')
  @ApiOperation({ summary: 'Make the tournament schedule public' })
  @ApiResponse({ status: 200, type: PublishedScheduleDto })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    return this.schedules.publish(user.id, leagueId, tournamentId);
  }

  @Patch('fixtures/:fixtureId/status')
  @HttpCode(204)
  @ApiOperation({ summary: 'Mark a published fixture live or cancelled' })
  @ApiParam({ name: 'fixtureId', schema: uuid })
  @ApiBody({ type: FixtureStatusDto })
  @ApiResponse({ status: 204 })
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leagueId', ParseUUIDPipe) leagueId: string,
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('fixtureId', ParseUUIDPipe) fixtureId: string,
    @Body(leagueInput(FixtureStatusDto)) body: FixtureStatusDto,
  ) {
    return this.schedules.setStatus(user.id, leagueId, tournamentId, fixtureId, body.status);
  }
}

@ApiTags('Tournament schedules')
@Controller('api/tournaments/:tournamentId/schedule')
export class PublicScheduleController {
  constructor(@Inject(ScheduleService) private readonly schedules: ScheduleService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse a published tournament schedule' })
  @ApiParam({ name: 'tournamentId', schema: uuid })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiResponse({ status: 200, type: ScheduleDto })
  @ApiResponse({ status: 404, description: 'Schedule is unpublished or absent.', type: ApiErrorDto })
  list(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query(leagueInput(PageDto)) query: PageDto,
  ) {
    return this.schedules.publicList(tournamentId, Number(query.page ?? 1));
  }
}
