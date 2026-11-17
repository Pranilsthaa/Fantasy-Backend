import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, exists, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../database/database.service";
import { leagueMembers, leagues, tournaments } from "../../db/tournaments";
import { users } from "../../db/users";
import type {
  CreateLeagueDto,
  CreateTournamentDto,
  SetStaffDto,
  UpdateLeagueDto,
  UpdateTournamentDto,
} from "./leagues.dto";

@Injectable()
export class LeaguesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  private get db() {
    return this.database.db;
  }

  async create(userId: string, input: CreateLeagueDto) {
    const slug = `${
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 90) || "league"
    }-${randomUUID()}`;
    const [league] = await this.db
      .insert(leagues)
      .values({
        ownerId: userId,
        name: input.name,
        location: input.location,
        slug,
        sport: "cricket",
      })
      .returning();
    return league;
  }

  async list(userId: string, page: number) {
    const data = await this.db
      .select()
      .from(leagues)
      .where(
        sql`${leagues.ownerId} = ${userId} OR ${exists(
          this.db
            .select({ id: leagueMembers.leagueId })
            .from(leagueMembers)
            .where(
              and(
                eq(leagueMembers.leagueId, leagues.id),
                eq(leagueMembers.userId, userId),
                eq(leagueMembers.isActive, true),
              ),
            ),
        )}`,
      )
      .orderBy(asc(leagues.createdAt), asc(leagues.id))
      .limit(20)
      .offset((page - 1) * 20);
    return { data, page, pageSize: 20 };
  }

  private async access(
    userId: string,
    leagueId: string,
    write = false,
    ownerOnly = false,
  ) {
    const league = await this.db.query.leagues.findFirst({
      where: eq(leagues.id, leagueId),
    });
    if (!league) throw new NotFoundException("League not found");
    if (league.ownerId === userId) return league;
    const member = await this.db.query.leagueMembers.findFirst({
      where: and(
        eq(leagueMembers.leagueId, leagueId),
        eq(leagueMembers.userId, userId),
        eq(leagueMembers.isActive, true),
      ),
    });
    // Outsiders do not learn whether a private league exists.
    if (!member) throw new NotFoundException("League not found");
    if (ownerOnly || (write && member.role !== "admin"))
      throw new ForbiddenException("Insufficient league permissions");
    return league;
  }

  details(userId: string, leagueId: string) {
    return this.access(userId, leagueId);
  }

  async update(userId: string, leagueId: string, input: UpdateLeagueDto) {
    await this.access(userId, leagueId, false, true);
    if (!Object.keys(input).length)
      throw new BadRequestException("At least one field is required");
    const [league] = await this.db
      .update(leagues)
      .set(input)
      .where(eq(leagues.id, leagueId))
      .returning();
    return league;
  }

  async staff(userId: string, leagueId: string, page: number) {
    await this.access(userId, leagueId, false, true);
    const data = await this.db
      .select({
        userId: users.id,
        username: users.username,
        role: leagueMembers.role,
      })
      .from(leagueMembers)
      .innerJoin(users, eq(users.id, leagueMembers.userId))
      .where(
        and(
          eq(leagueMembers.leagueId, leagueId),
          eq(leagueMembers.isActive, true),
        ),
      )
      .orderBy(asc(users.username), asc(users.id))
      .limit(20)
      .offset((page - 1) * 20);
    return { data, page, pageSize: 20 };
  }

  async setStaff(userId: string, leagueId: string, input: SetStaffDto) {
    const league = await this.access(userId, leagueId, false, true);
    const user = await this.db.query.users.findFirst({
      where: sql`lower(${users.username}) = ${input.username}`,
      columns: { id: true, username: true },
    });
    if (!user) throw new NotFoundException("Registered user not found");
    if (user.id === league.ownerId)
      throw new BadRequestException(
        "The owner cannot be assigned a staff role",
      );
    await this.db
      .insert(leagueMembers)
      .values({ leagueId, userId: user.id, role: input.role })
      .onConflictDoUpdate({
        target: [leagueMembers.leagueId, leagueMembers.userId],
        set: { role: input.role, isActive: true },
      });
    return { userId: user.id, username: user.username, role: input.role };
  }

  async removeStaff(userId: string, leagueId: string, memberId: string) {
    const league = await this.access(userId, leagueId, false, true);
    if (memberId === league.ownerId)
      throw new BadRequestException("The owner cannot be removed");
    await this.db
      .update(leagueMembers)
      .set({ isActive: false })
      .where(
        and(
          eq(leagueMembers.leagueId, leagueId),
          eq(leagueMembers.userId, memberId),
        ),
      );
  }

  private dates(
    input: CreateTournamentDto | UpdateTournamentDto,
    existing?: typeof tournaments.$inferSelect,
  ) {
    if (input.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: input.timezone });
      } catch {
        throw new BadRequestException("Invalid IANA timezone");
      }
    }
    const startsAt =
      input.startsAt === undefined
        ? existing?.startsAt
        : new Date(input.startsAt);
    const endsAt =
      input.endsAt === undefined ? existing?.endsAt : new Date(input.endsAt);
    if (startsAt && endsAt && endsAt < startsAt)
      throw new BadRequestException("endsAt must be on or after startsAt");
    return { startsAt, endsAt };
  }

  private conflict(error: unknown): never {
    const failure = error as { code?: string; cause?: { code?: string } };
    if ((failure.cause?.code ?? failure.code) === "23505")
      throw new ConflictException(
        "A tournament already exists for this league and season",
      );
    throw error;
  }

  async createTournament(
    userId: string,
    leagueId: string,
    input: CreateTournamentDto,
  ) {
    await this.access(userId, leagueId, true);
    const dates = this.dates(input);
    try {
      const [tournament] = await this.db
        .insert(tournaments)
        .values({
          leagueId,
          name: input.name,
          season: input.season,
          timezone: input.timezone ?? "Asia/Kathmandu",
          ...dates,
          status: "draft",
        })
        .returning();
      return tournament;
    } catch (error) {
      this.conflict(error);
    }
  }

  async listTournaments(userId: string, leagueId: string, page: number) {
    await this.access(userId, leagueId);
    const data = await this.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.leagueId, leagueId))
      .orderBy(asc(tournaments.createdAt), asc(tournaments.id))
      .limit(20)
      .offset((page - 1) * 20);
    return { data, page, pageSize: 20 };
  }

  async tournament(userId: string, leagueId: string, tournamentId: string) {
    await this.access(userId, leagueId);
    const row = await this.db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.id, tournamentId),
        eq(tournaments.leagueId, leagueId),
      ),
    });
    if (!row) throw new NotFoundException("Tournament not found");
    return row;
  }

  async updateTournament(
    userId: string,
    leagueId: string,
    tournamentId: string,
    input: UpdateTournamentDto,
  ) {
    await this.access(userId, leagueId, true);
    if (!Object.keys(input).length)
      throw new BadRequestException("At least one field is required");
    // Lock only the row being edited so concurrent partial date edits validate
    // against current values and cannot create an invalid date range.
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(tournaments)
        .where(
          and(
            eq(tournaments.id, tournamentId),
            eq(tournaments.leagueId, leagueId),
          ),
        )
        .for("update");
      if (!existing) throw new NotFoundException("Tournament not found");
      if (existing.status !== "draft")
        throw new ConflictException("Only draft tournaments can be edited");
      const dates = this.dates(input, existing);
      try {
        const [row] = await tx
          .update(tournaments)
          .set({ ...input, ...dates })
          .where(eq(tournaments.id, tournamentId))
          .returning();
        return row;
      } catch (error) {
        this.conflict(error);
      }
    });
  }
}
