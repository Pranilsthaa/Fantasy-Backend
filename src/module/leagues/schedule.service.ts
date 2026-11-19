import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service";
import { cricketScoring } from "../../db/cricket-scoring";
import { matches } from "../../db/matches";
import { matchPlayers } from "../../db/statistics";
import { tournaments, tournamentTeams } from "../../db/tournaments";
import { LeaguesService } from "./leagues.service";
import type {
  CreateFixtureDto,
  EditFixtureDto,
  FixtureStatusDto,
} from "./schedule.dto";

type Db = DatabaseService["db"];
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

@Injectable()
export class ScheduleService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(LeaguesService) private readonly leagues: LeaguesService,
  ) {}

  private async write<T>(
    userId: string,
    leagueId: string,
    tournamentId: string,
    action: (
      tx: Transaction,
      tournament: typeof tournaments.$inferSelect,
    ) => Promise<T>,
  ) {
    await this.leagues.access(userId, leagueId, true);
    try {
      return await this.database.db.transaction(async (tx) => {
        // Share the tournament lock with roster edits and other schedule writes.
        const [tournament] = await tx
          .select()
          .from(tournaments)
          .where(
            and(
              eq(tournaments.id, tournamentId),
              eq(tournaments.leagueId, leagueId),
            ),
          )
          .for("update");
        if (!tournament) throw new NotFoundException("Tournament not found");
        if (
          tournament.status === "completed" ||
          tournament.status === "archived"
        ) {
          throw new ConflictException("This tournament is closed");
        }
        return action(tx, tournament);
      });
    } catch (error) {
      const failure = error as { code?: string; cause?: { code?: string } };
      const code = failure.cause?.code ?? failure.code;
      if (code === "23505")
        throw new ConflictException(
          "This tournament already has that match number",
        );
      if (code === "23503")
        throw new ConflictException(
          "The fixture is referenced or an enrolled team is no longer available",
        );
      throw error;
    }
  }

  private async checkTeams(
    tx: Transaction,
    tournamentId: string,
    team1Id: string,
    team2Id: string,
  ) {
    if (team1Id.toLowerCase() === team2Id.toLowerCase())
      throw new BadRequestException("Select two different teams");
    const enrolled = await tx
      .select({ id: tournamentTeams.teamId })
      .from(tournamentTeams)
      .where(
        and(
          eq(tournamentTeams.tournamentId, tournamentId),
          inArray(tournamentTeams.teamId, [team1Id, team2Id]),
        ),
      );
    if (enrolled.length !== 2)
      throw new BadRequestException(
        "Both teams must be enrolled in this tournament",
      );
  }

  private async getFixture(
    tx: Transaction,
    tournamentId: string,
    fixtureId: string,
  ) {
    const [fixture] = await tx
      .select()
      .from(matches)
      .where(
        and(eq(matches.id, fixtureId), eq(matches.tournamentId, tournamentId)),
      )
      .for("update");
    if (!fixture) throw new NotFoundException("Fixture not found");
    return fixture;
  }

  private async fixtures(
    tournament: typeof tournaments.$inferSelect,
    page: number,
  ) {
    const columns = { id: true, name: true, code: true, logo: true } as const;
    const fixtures = await this.database.db.query.matches.findMany({
      where: eq(matches.tournamentId, tournament.id),
      columns: {
        id: true,
        date: true,
        matchNumber: true,
        venue: true,
        status: true,
      },
      with: { team1: { columns }, team2: { columns } },
      orderBy: [asc(matches.date), asc(matches.matchNumber)],
      limit: 20,
      offset: (page - 1) * 20,
    });
    const scorecards = fixtures.length
      ? await this.database.db
          .select({ matchId: cricketScoring.matchId })
          .from(cricketScoring)
          .where(
            inArray(
              cricketScoring.matchId,
              fixtures.map(({ id }) => id),
            ),
          )
      : [];
    const scoredMatchIds = new Set(scorecards.map(({ matchId }) => matchId));
    const data = fixtures.map((fixture) => ({
      ...fixture,
      hasScorecard: scoredMatchIds.has(fixture.id),
    }));
    return {
      tournamentId: tournament.id,
      name: tournament.name,
      timezone: tournament.timezone,
      publishedAt: tournament.schedulePublishedAt,
      data,
      page,
      pageSize: 20,
    };
  }

  async staffList(
    userId: string,
    leagueId: string,
    tournamentId: string,
    page: number,
  ) {
    const tournament = await this.leagues.tournament(
      userId,
      leagueId,
      tournamentId,
    );
    return this.fixtures(tournament, page);
  }

  async publicList(tournamentId: string, page: number) {
    const tournament = await this.database.db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.id, tournamentId),
        isNotNull(tournaments.schedulePublishedAt),
      ),
    });
    if (!tournament)
      throw new NotFoundException("Published schedule not found");
    return this.fixtures(tournament, page);
  }

  async create(
    userId: string,
    leagueId: string,
    tournamentId: string,
    input: CreateFixtureDto,
  ) {
    return this.write(userId, leagueId, tournamentId, async (tx) => {
      await this.checkTeams(tx, tournamentId, input.team1Id, input.team2Id);
      const [fixture] = await tx
        .insert(matches)
        .values({
          tournamentId,
          matchNumber: input.matchNumber,
          team1_id: input.team1Id,
          team2_id: input.team2Id,
          date: new Date(input.date),
          venue: input.venue,
        })
        .returning({ id: matches.id });
      return fixture;
    });
  }

  async edit(
    userId: string,
    leagueId: string,
    tournamentId: string,
    fixtureId: string,
    input: EditFixtureDto,
  ) {
    if (!Object.keys(input).length)
      throw new BadRequestException("At least one field is required");
    return this.write(userId, leagueId, tournamentId, async (tx) => {
      const fixture = await this.getFixture(tx, tournamentId, fixtureId);
      if (fixture.status !== "upcoming")
        throw new ConflictException("Only upcoming fixtures can be edited");
      const participant = await tx.query.matchPlayers.findFirst({
        where: eq(matchPlayers.matchId, fixtureId),
        columns: { matchId: true },
      });
      if (participant)
        throw new ConflictException("This fixture has recorded participants");
      const team1Id = input.team1Id ?? fixture.team1_id;
      const team2Id = input.team2Id ?? fixture.team2_id;
      await this.checkTeams(tx, tournamentId, team1Id, team2Id);
      await tx
        .update(matches)
        .set({
          team1_id: team1Id,
          team2_id: team2Id,
          matchNumber: input.matchNumber,
          venue: input.venue,
          date: input.date === undefined ? undefined : new Date(input.date),
        })
        .where(eq(matches.id, fixtureId));
    });
  }

  async remove(
    userId: string,
    leagueId: string,
    tournamentId: string,
    fixtureId: string,
  ) {
    return this.write(
      userId,
      leagueId,
      tournamentId,
      async (tx, tournament) => {
        const fixture = await this.getFixture(tx, tournamentId, fixtureId);
        if (tournament.schedulePublishedAt || fixture.status !== "upcoming") {
          throw new ConflictException(
            "Only upcoming fixtures on unpublished schedules can be deleted",
          );
        }
        await tx.delete(matches).where(eq(matches.id, fixtureId));
      },
    );
  }

  async publish(userId: string, leagueId: string, tournamentId: string) {
    return this.write(
      userId,
      leagueId,
      tournamentId,
      async (tx, tournament) => {
        if (tournament.schedulePublishedAt)
          return { publishedAt: tournament.schedulePublishedAt };
        const fixture = await tx.query.matches.findFirst({
          where: eq(matches.tournamentId, tournamentId),
          columns: { id: true },
        });
        if (!fixture)
          throw new ConflictException(
            "Add a fixture before publishing the schedule",
          );
        const publishedAt = new Date();
        await tx
          .update(tournaments)
          .set({ schedulePublishedAt: publishedAt })
          .where(eq(tournaments.id, tournamentId));
        return { publishedAt };
      },
    );
  }

  async setStatus(
    userId: string,
    leagueId: string,
    tournamentId: string,
    fixtureId: string,
    status: FixtureStatusDto["status"],
  ) {
    return this.write(
      userId,
      leagueId,
      tournamentId,
      async (tx, tournament) => {
        if (!tournament.schedulePublishedAt)
          throw new ConflictException(
            "Publish the schedule before changing a fixture status",
          );
        const fixture = await this.getFixture(tx, tournamentId, fixtureId);
        if (fixture.status === status) return;
        if (
          fixture.status !== "upcoming" &&
          !(fixture.status === "live" && status === "cancelled")
        ) {
          throw new ConflictException("Invalid fixture status transition");
        }
        await tx
          .update(matches)
          .set({ status })
          .where(eq(matches.id, fixtureId));
      },
    );
  }
}
