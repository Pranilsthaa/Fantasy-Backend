import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { DatabaseService } from "../../../database/database.service";
import { cricketPlays, cricketScoring } from "../../../db/cricket-scoring";
import { matches } from "../../../db/matches";
import { players } from "../../../db/players";
import {
  cricketInnings,
  matchPlayers,
  matchResults,
  matchStatRevisions,
  playerMatchStats,
  statDefinitions,
} from "../../../db/statistics";
import { tournamentPlayers, tournaments } from "../../../db/tournaments";
import { LeaguesService } from "../leagues.service";
import {
  completedResult,
  CricketInputError,
  metricNames,
  scorecard,
  type Play,
} from "./cricket";
import type { SetLineupsDto } from "./scoring.dto";

type Transaction = Parameters<
  Parameters<DatabaseService["db"]["transaction"]>[0]
>[0];
type Match = typeof matches.$inferSelect & { tournamentId: string };
type State = typeof cricketScoring.$inferSelect;
type Card = ReturnType<typeof scorecard>;
type SavedPlay = { sequence: number; play: Play };

@Injectable()
export class ScoringService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(LeaguesService) private readonly leagues: LeaguesService,
  ) {}

  private get db() {
    return this.database.db;
  }

  private async fixture(
    tx: Transaction,
    tournamentId: string,
    fixtureId: string,
    lock: boolean,
    leagueId?: string,
  ) {
    const query = tx
      .select({ match: matches })
      .from(matches)
      .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
      .where(
        and(
          eq(matches.id, fixtureId),
          eq(matches.tournamentId, tournamentId),
          isNotNull(tournaments.schedulePublishedAt),
          leagueId ? eq(tournaments.leagueId, leagueId) : undefined,
        ),
      );
    if (lock) {
      // Acquire the tournament lock first, as fixture and roster edits do.
      const [tournament] = await tx
        .select({ id: tournaments.id })
        .from(tournaments)
        .where(
          and(
            eq(tournaments.id, tournamentId),
            isNotNull(tournaments.schedulePublishedAt),
            leagueId ? eq(tournaments.leagueId, leagueId) : undefined,
          ),
        )
        .for("update");
      if (!tournament)
        throw new NotFoundException("Published fixture not found");
    }
    const [row] = lock
      ? await query.for("update", { of: matches })
      : await query;
    if (!row?.match.tournamentId)
      throw new NotFoundException("Published fixture not found");
    return { ...row.match, tournamentId: row.match.tournamentId };
  }

  private async write<T>(
    userId: string,
    leagueId: string,
    tournamentId: string,
    fixtureId: string,
    admin: boolean,
    action: (
      tx: Transaction,
      fixture: Match,
      state: State | undefined,
    ) => Promise<T>,
  ) {
    await this.leagues.access(userId, leagueId, admin);
    return this.db.transaction(async (tx) => {
      const fixture = await this.fixture(
        tx,
        tournamentId,
        fixtureId,
        true,
        leagueId,
      );
      const state = await tx.query.cricketScoring.findFirst({
        where: eq(cricketScoring.matchId, fixture.id),
      });
      return action(tx, fixture, state);
    });
  }

  private async lineup(tx: Transaction, fixtureId: string) {
    return tx
      .select({
        id: tournamentPlayers.id,
        teamId: tournamentPlayers.teamId,
        name: players.name,
      })
      .from(matchPlayers)
      .innerJoin(
        tournamentPlayers,
        eq(tournamentPlayers.id, matchPlayers.tournamentPlayerId),
      )
      .innerJoin(players, eq(players.id, tournamentPlayers.playerId))
      .where(eq(matchPlayers.matchId, fixtureId))
      .orderBy(asc(players.name), asc(tournamentPlayers.id));
  }

  private plays(tx: Transaction, fixtureId: string) {
    return tx
      .select({ sequence: cricketPlays.sequence, play: cricketPlays.play })
      .from(cricketPlays)
      .where(
        and(eq(cricketPlays.matchId, fixtureId), isNull(cricketPlays.voidedAt)),
      )
      .orderBy(asc(cricketPlays.sequence));
  }

  private async card(
    tx: Transaction,
    fixture: Match,
    state: State,
    events?: SavedPlay[],
  ) {
    const lineup = await this.lineup(tx, fixture.id);
    const plays = events ?? (await this.plays(tx, fixture.id));
    return scorecard(
      [fixture.team1_id, fixture.team2_id],
      lineup,
      state.overs,
      plays,
    );
  }

  private async official(tx: Transaction, matchId: string) {
    const [row] = await tx
      .select({
        revision: matchStatRevisions.revision,
        publishedAt: matchStatRevisions.publishedAt,
        outcome: matchResults.outcome,
        winnerTeamId: matchResults.winnerTeamId,
        cricketCard: matchStatRevisions.cricketCard,
      })
      .from(matchStatRevisions)
      .innerJoin(
        matchResults,
        eq(matchResults.revisionId, matchStatRevisions.id),
      )
      .where(
        and(
          eq(matchStatRevisions.matchId, matchId),
          eq(matchStatRevisions.status, "published"),
        ),
      );
    return row ?? null;
  }

  async read(
    tournamentId: string,
    fixtureId: string,
    staff?: { userId: string; leagueId: string },
  ) {
    if (staff) await this.leagues.access(staff.userId, staff.leagueId);
    return this.db.transaction(
      async (tx) => {
        const fixture = await this.fixture(
          tx,
          tournamentId,
          fixtureId,
          false,
          staff?.leagueId,
        );
        const state = await tx.query.cricketScoring.findFirst({
          where: eq(cricketScoring.matchId, fixtureId),
        });
        if (!state)
          throw new NotFoundException("Scorecard has not been set up");
        const published = await this.official(tx, fixtureId);
        const official = published && {
          revision: published.revision,
          publishedAt: published.publishedAt,
          outcome: published.outcome,
          winnerTeamId: published.winnerTeamId,
        };
        // Once a scorecard is published, spectators see that snapshot until a correction is published.
        // Staff see the current scoring state, including edits in progress.
        const card =
          !staff && published?.cricketCard
            ? published.cricketCard
            : await this.card(tx, fixture, state);
        return {
          fixtureId,
          overs: state.overs,
          status: fixture.status,
          official,
          ...card,
          ...(staff
            ? { version: state.version, correcting: state.correcting }
            : {}),
        };
      },
      // Read the scorecard and its version from the same snapshot during concurrent scoring.
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  setup(
    userId: string,
    leagueId: string,
    tournamentId: string,
    fixtureId: string,
    input: SetLineupsDto,
  ) {
    return this.write(
      userId,
      leagueId,
      tournamentId,
      fixtureId,
      false,
      async (tx, fixture, state) => {
        if (!["upcoming", "live"].includes(fixture.status))
          throw new ConflictException("This fixture is closed");
        if (state) throw new ConflictException("Lineups have already been set");
        const ids = [...input.team1, ...input.team2].map((id) =>
          id.toLowerCase(),
        );
        if (new Set(ids).size !== ids.length)
          throw new BadRequestException(
            "Lineup registration IDs must be distinct",
          );
        const selected = await tx
          .select({
            id: tournamentPlayers.id,
            teamId: tournamentPlayers.teamId,
          })
          .from(tournamentPlayers)
          .where(
            and(
              eq(tournamentPlayers.tournamentId, tournamentId),
              eq(tournamentPlayers.isActive, true),
              inArray(tournamentPlayers.id, ids),
            ),
          );
        const teams = new Map(
          selected.map((player) => [player.id, player.teamId]),
        );
        if (
          input.team1.some(
            (id) => teams.get(id.toLowerCase()) !== fixture.team1_id,
          ) ||
          input.team2.some(
            (id) => teams.get(id.toLowerCase()) !== fixture.team2_id,
          )
        ) {
          throw new BadRequestException(
            "Select active tournament players from the two fixture teams",
          );
        }
        const existing = await this.lineup(tx, fixtureId);
        if (existing.length)
          throw new ConflictException(
            "Match participants have already been recorded",
          );
        await tx
          .insert(cricketScoring)
          .values({ matchId: fixtureId, overs: input.overs });
        await tx
          .insert(matchPlayers)
          .values(
            ids.map((tournamentPlayerId) => ({
              matchId: fixtureId,
              tournamentId,
              tournamentPlayerId,
            })),
          );
        // Freeze fixture teams when scoring setup starts so lineup membership cannot drift.
        return { version: 0 };
      },
    );
  }

  private checkVersion(state: State | undefined, version: number) {
    if (!state) throw new NotFoundException("Set up the lineups first");
    if (state.version !== version)
      throw new ConflictException("Scorecard changed. Reload before retrying");
    return state;
  }

  private checkEditable(fixture: Match, state: State) {
    if (fixture.status !== "live" && !state.correcting)
      throw new ConflictException(
        "Scoring requires a live fixture or an open correction",
      );
  }

  private async bump(
    tx: Transaction,
    state: State,
    changes: Partial<Pick<State, "correcting">> = {},
  ) {
    const version = state.version + 1;
    await tx
      .update(cricketScoring)
      .set({ ...changes, version })
      .where(eq(cricketScoring.matchId, state.matchId));
    return { version };
  }

  append(
    userId: string,
    leagueId: string,
    tournamentId: string,
    fixtureId: string,
    version: number,
    play: Play,
  ) {
    return this.write(
      userId,
      leagueId,
      tournamentId,
      fixtureId,
      false,
      async (tx, fixture, current) => {
        const state = this.checkVersion(current, version);
        this.checkEditable(fixture, state);
        const events = await this.plays(tx, fixtureId);
        if (events.length >= 1500)
          throw new ConflictException(
            "This fixture reached the scoring action limit",
          );
        const event = { sequence: version + 1, play };
        try {
          await this.card(tx, fixture, state, [...events, event]);
        } catch (error) {
          if (error instanceof CricketInputError)
            throw new BadRequestException(error.message);
          throw error;
        }
        await tx
          .insert(cricketPlays)
          .values({ ...event, matchId: fixtureId, recordedBy: userId });
        return this.bump(tx, state);
      },
    );
  }

  undo(
    userId: string,
    leagueId: string,
    tournamentId: string,
    fixtureId: string,
    version: number,
  ) {
    return this.write(
      userId,
      leagueId,
      tournamentId,
      fixtureId,
      false,
      async (tx, fixture, current) => {
        const state = this.checkVersion(current, version);
        this.checkEditable(fixture, state);
        const last = await tx.query.cricketPlays.findFirst({
          where: and(
            eq(cricketPlays.matchId, fixtureId),
            isNull(cricketPlays.voidedAt),
          ),
          orderBy: [desc(cricketPlays.sequence)],
        });
        if (!last)
          throw new ConflictException("There is no scoring action to undo");
        await tx
          .update(cricketPlays)
          .set({ voidedAt: new Date(), voidedBy: userId })
          .where(
            and(
              eq(cricketPlays.matchId, fixtureId),
              eq(cricketPlays.sequence, last.sequence),
            ),
          );
        return this.bump(tx, state);
      },
    );
  }

  openCorrection(
    userId: string,
    leagueId: string,
    tournamentId: string,
    fixtureId: string,
    version: number,
  ) {
    return this.write(
      userId,
      leagueId,
      tournamentId,
      fixtureId,
      true,
      async (tx, _fixture, current) => {
        const state = this.checkVersion(current, version);
        if (
          state.correcting ||
          !(await this.official(tx, fixtureId))?.cricketCard
        )
          throw new ConflictException(
            "A published scorecard is required to open a correction",
          );
        return this.bump(tx, state, { correcting: true });
      },
    );
  }

  publish(
    userId: string,
    leagueId: string,
    tournamentId: string,
    fixtureId: string,
    version: number,
    abandoned: boolean,
  ) {
    return this.write(
      userId,
      leagueId,
      tournamentId,
      fixtureId,
      true,
      async (tx, fixture, current) => {
        const state = this.checkVersion(current, version);
        if (
          !state.correcting &&
          fixture.status !== "live" &&
          !(fixture.status === "cancelled" && abandoned)
        ) {
          throw new ConflictException(
            "Publish a live scorecard, abandoned fixture, or open correction",
          );
        }
        const card = await this.card(tx, fixture, state);
        const result = abandoned
          ? { outcome: "no_result" as const, winnerTeamId: null }
          : completedResult(card.innings);
        if (!result)
          throw new ConflictException(
            "Complete both innings before publishing a result",
          );
        const last = await tx.query.matchStatRevisions.findFirst({
          where: eq(matchStatRevisions.matchId, fixtureId),
          orderBy: [desc(matchStatRevisions.revision)],
        });
        await tx
          .update(matchStatRevisions)
          .set({ status: "superseded" })
          .where(
            and(
              eq(matchStatRevisions.matchId, fixtureId),
              eq(matchStatRevisions.status, "published"),
            ),
          );
        const publishedAt = new Date();
        const revision = (last?.revision ?? 0) + 1;
        const [row] = await tx
          .insert(matchStatRevisions)
          .values({
            matchId: fixtureId,
            tournamentId,
            revision,
            status: "published",
            submittedBy: userId,
            publishedAt,
            cricketCard: card,
          })
          .returning({ id: matchStatRevisions.id });
        if (!row) throw new Error("Could not create scorecard revision");
        const scope = { revisionId: row.id, matchId: fixtureId, tournamentId };
        await tx.insert(matchResults).values({ ...scope, ...result });
        await this.snapshot(tx, card, scope);
        await tx
          .update(matches)
          .set({ status: abandoned ? "cancelled" : "completed" })
          .where(eq(matches.id, fixtureId));
        const next = await this.bump(tx, state, { correcting: false });
        return { ...next, revision, publishedAt, ...result };
      },
    );
  }

  private async snapshot(
    tx: Transaction,
    card: Card,
    scope: { revisionId: string; matchId: string; tournamentId: string },
  ) {
    if (card.innings.length) {
      await tx.insert(cricketInnings).values(
        card.innings.map((i) => ({
          ...scope,
          number: i.number,
          battingTeamId: i.battingTeamId,
          bowlingTeamId: i.bowlingTeamId,
          runs: i.runs,
          wickets: i.wickets,
          legalBalls: i.legalBalls,
          extras: i.extras,
        })),
      );
    }
    const metrics = Object.entries(metricNames).map(([key, name]) => ({
      sport: "cricket",
      key,
      name,
    }));
    await tx.insert(statDefinitions).values(metrics).onConflictDoNothing();
    const definitions = await tx
      .select({ id: statDefinitions.id, key: statDefinitions.key })
      .from(statDefinitions)
      .where(
        and(
          eq(statDefinitions.sport, "cricket"),
          inArray(statDefinitions.key, Object.keys(metricNames)),
        ),
      );
    const data = card.players.flatMap((player) =>
      definitions.map(({ id, key }) => ({
        ...scope,
        tournamentPlayerId: player.id,
        statDefinitionId: id,
        value: String(player[key as keyof typeof metricNames]),
      })),
    );
    if (data.length) await tx.insert(playerMatchStats).values(data);
  }
}
