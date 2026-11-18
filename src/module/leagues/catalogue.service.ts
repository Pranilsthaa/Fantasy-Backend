import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service";
import { players } from "../../db/players";
import { matchPlayers } from "../../db/statistics";
import { teams } from "../../db/teams";
import {
  tournamentPlayers,
  tournaments,
  tournamentTeams,
} from "../../db/tournaments";
import type {
  CreatePlayerDto,
  CreateTeamDto,
  EditPlayerDto,
  EditTeamDto,
  RegisterPlayerDto,
} from "./catalogue.dto";
import { LeaguesService } from "./leagues.service";

type Db = DatabaseService["db"];
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
const pageSize = 20;
const pageResult = <T>(data: T[], page: number) => ({ data, page, pageSize });
const ageValue = (age: number | null | undefined) =>
  typeof age === "number" ? String(age) : age;

const teamFields = {
  id: teams.id,
  name: teams.name,
  code: teams.code,
  logo: teams.logo,
};
const playerFields = {
  id: players.id,
  name: players.name,
  role: players.role,
  age: players.age,
};

@Injectable()
export class CatalogueService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(LeaguesService) private readonly leagues: LeaguesService,
  ) {}

  private get db() {
    return this.database.db;
  }

  private async handleConflict<T>(
    operation: () => Promise<T>,
    code: string,
    message: string,
  ) {
    try {
      return await operation();
    } catch (error) {
      const failure = error as { code?: string; cause?: { code?: string } };
      if ((failure.cause?.code ?? failure.code) === code)
        throw new ConflictException(message);
      throw error;
    }
  }

  async listTeams(userId: string, leagueId: string, page: number) {
    await this.leagues.access(userId, leagueId);
    const data = await this.db
      .select(teamFields)
      .from(teams)
      .where(eq(teams.leagueId, leagueId))
      .orderBy(asc(teams.name), asc(teams.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return pageResult(data, page);
  }

  async createTeam(userId: string, leagueId: string, input: CreateTeamDto) {
    await this.leagues.access(userId, leagueId, true);
    const [team] = await this.handleConflict(
      () =>
        this.db
          .insert(teams)
          .values({ ...input, leagueId })
          .returning(teamFields),
      "23505",
      "This league already has a team with that name or code",
    );
    return team;
  }

  async editTeam(
    userId: string,
    leagueId: string,
    teamId: string,
    input: EditTeamDto,
  ) {
    await this.leagues.access(userId, leagueId, true);
    if (!Object.keys(input).length)
      throw new BadRequestException("At least one field is required");
    const [team] = await this.handleConflict(
      () =>
        this.db
          .update(teams)
          .set(input)
          .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)))
          .returning(teamFields),
      "23505",
      "This league already has a team with that name or code",
    );
    if (!team) throw new NotFoundException("Team not found");
    return team;
  }

  async listPlayers(userId: string, leagueId: string, page: number) {
    await this.leagues.access(userId, leagueId);
    const data = await this.db
      .select(playerFields)
      .from(players)
      .where(eq(players.leagueId, leagueId))
      .orderBy(asc(players.name), asc(players.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return pageResult(data, page);
  }

  async createPlayer(userId: string, leagueId: string, input: CreatePlayerDto) {
    await this.leagues.access(userId, leagueId, true);
    const [player] = await this.db
      .insert(players)
      .values({ ...input, age: ageValue(input.age), leagueId })
      .returning(playerFields);
    return player;
  }

  async editPlayer(
    userId: string,
    leagueId: string,
    playerId: string,
    input: EditPlayerDto,
  ) {
    await this.leagues.access(userId, leagueId, true);
    if (!Object.keys(input).length)
      throw new BadRequestException("At least one field is required");
    const [player] = await this.db
      .update(players)
      .set({ ...input, age: ageValue(input.age), updatedAt: new Date() })
      .where(and(eq(players.id, playerId), eq(players.leagueId, leagueId)))
      .returning(playerFields);
    if (!player) throw new NotFoundException("Player not found");
    return player;
  }

  async removeTeam(userId: string, leagueId: string, teamId: string) {
    await this.leagues.access(userId, leagueId, true);
    await this.handleConflict(
      () =>
        this.db
          .delete(teams)
          .where(and(eq(teams.id, teamId), eq(teams.leagueId, leagueId))),
      "23503",
      "Remove the team from its tournaments before deleting its profile",
    );
  }

  async removePlayer(userId: string, leagueId: string, playerId: string) {
    await this.leagues.access(userId, leagueId, true);
    await this.handleConflict(
      () =>
        this.db
          .delete(players)
          .where(and(eq(players.id, playerId), eq(players.leagueId, leagueId))),
      "23503",
      "The player profile is referenced by a tournament registration",
    );
  }

  private async editRoster<T>(
    userId: string,
    leagueId: string,
    tournamentId: string,
    edit: (tx: Transaction) => Promise<T>,
  ) {
    await this.leagues.access(userId, leagueId, true);
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ status: tournaments.status })
        .from(tournaments)
        .where(
          and(
            eq(tournaments.id, tournamentId),
            eq(tournaments.leagueId, leagueId),
          ),
        )
        .for("update");
      if (!row) throw new NotFoundException("Tournament not found");
      if (row.status !== "draft")
        throw new ConflictException(
          "Only draft tournament rosters can be edited",
        );
      return edit(tx);
    });
  }

  async listTournamentTeams(
    userId: string,
    leagueId: string,
    tournamentId: string,
    page: number,
  ) {
    await this.leagues.tournament(userId, leagueId, tournamentId);
    const data = await this.db
      .select(teamFields)
      .from(tournamentTeams)
      .innerJoin(teams, eq(teams.id, tournamentTeams.teamId))
      .where(eq(tournamentTeams.tournamentId, tournamentId))
      .orderBy(asc(teams.name), asc(teams.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return pageResult(data, page);
  }

  async enrollTeam(
    userId: string,
    leagueId: string,
    tournamentId: string,
    teamId: string,
  ) {
    return this.editRoster(userId, leagueId, tournamentId, async (tx) => {
      const team = await tx.query.teams.findFirst({
        columns: { id: true },
        where: and(eq(teams.id, teamId), eq(teams.leagueId, leagueId)),
      });
      if (!team) throw new NotFoundException("Team not found");
      await this.handleConflict(
        () =>
          tx
            .insert(tournamentTeams)
            .values({ tournamentId, teamId })
            .onConflictDoNothing(),
        "23503",
        "Team is no longer available",
      );
    });
  }

  async unenrollTeam(
    userId: string,
    leagueId: string,
    tournamentId: string,
    teamId: string,
  ) {
    return this.editRoster(userId, leagueId, tournamentId, async (tx) => {
      await this.handleConflict(
        () =>
          tx
            .delete(tournamentTeams)
            .where(
              and(
                eq(tournamentTeams.tournamentId, tournamentId),
                eq(tournamentTeams.teamId, teamId),
              ),
            ),
        "23503",
        "The team is referenced by a tournament player or match record",
      );
    });
  }

  async listRoster(
    userId: string,
    leagueId: string,
    tournamentId: string,
    page: number,
  ) {
    await this.leagues.tournament(userId, leagueId, tournamentId);
    const data = await this.db
      .select({
        id: tournamentPlayers.id,
        playerId: players.id,
        name: players.name,
        age: players.age,
        teamId: tournamentPlayers.teamId,
        role: tournamentPlayers.role,
        isActive: tournamentPlayers.isActive,
      })
      .from(tournamentPlayers)
      .innerJoin(players, eq(players.id, tournamentPlayers.playerId))
      .where(eq(tournamentPlayers.tournamentId, tournamentId))
      .orderBy(asc(players.name), asc(tournamentPlayers.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return pageResult(data, page);
  }

  private async ensureNoMatchHistory(tx: Transaction, registrationId: string) {
    const match = await tx.query.matchPlayers.findFirst({
      columns: { matchId: true },
      where: eq(matchPlayers.tournamentPlayerId, registrationId),
    });
    if (match)
      throw new ConflictException("This registration has match history");
  }

  async registerPlayer(
    userId: string,
    leagueId: string,
    tournamentId: string,
    playerId: string,
    input: RegisterPlayerDto,
  ) {
    return this.editRoster(userId, leagueId, tournamentId, async (tx) => {
      const player = await tx.query.players.findFirst({
        columns: { role: true },
        where: and(eq(players.id, playerId), eq(players.leagueId, leagueId)),
      });
      if (!player) throw new NotFoundException("Player not found");
      const team = await tx.query.tournamentTeams.findFirst({
        columns: { teamId: true },
        where: and(
          eq(tournamentTeams.tournamentId, tournamentId),
          eq(tournamentTeams.teamId, input.teamId),
        ),
      });
      if (!team)
        throw new NotFoundException("Team is not enrolled in this tournament");

      const where = and(
        eq(tournamentPlayers.tournamentId, tournamentId),
        eq(tournamentPlayers.playerId, playerId),
      );
      const [existing] = await tx
        .select()
        .from(tournamentPlayers)
        .where(where)
        .for("update");
      const role = input.role ?? existing?.role ?? player.role;
      if (existing) {
        if (
          existing.teamId === input.teamId &&
          existing.role === role &&
          existing.isActive
        )
          return;
        await this.ensureNoMatchHistory(tx, existing.id);
      }
      await this.handleConflict(
        () =>
          tx
            .insert(tournamentPlayers)
            .values({ tournamentId, playerId, teamId: input.teamId, role })
            .onConflictDoUpdate({
              target: [
                tournamentPlayers.tournamentId,
                tournamentPlayers.playerId,
              ],
              set: { teamId: input.teamId, role, isActive: true },
            }),
        "23503",
        "Player or enrolled team is no longer available",
      );
    });
  }

  async unregisterPlayer(
    userId: string,
    leagueId: string,
    tournamentId: string,
    playerId: string,
  ) {
    return this.editRoster(userId, leagueId, tournamentId, async (tx) => {
      const where = and(
        eq(tournamentPlayers.tournamentId, tournamentId),
        eq(tournamentPlayers.playerId, playerId),
      );
      const [existing] = await tx
        .select({ id: tournamentPlayers.id })
        .from(tournamentPlayers)
        .where(where)
        .for("update");
      if (!existing) return;
      await this.ensureNoMatchHistory(tx, existing.id);
      await this.handleConflict(
        () => tx.delete(tournamentPlayers).where(where),
        "23503",
        "This registration is referenced by tournament history",
      );
    });
  }
}
