import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { DatabaseService } from "../database/database.service";
import { authSessions } from "../db/auth-sessions";
import { users } from "../db/users";

@Injectable()
export class AuthRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  findByEmail(email: string) {
    return this.database.db.query.users.findFirst({
      where: sql`lower(${users.email}) = ${email}`,
    });
  }

  async createUser(username: string, email: string, passwordHash: string) {
    const [user] = await this.database.db
      .insert(users)
      .values({ username, email, passwordHash, role: "user" })
      .returning();
    if (!user) throw new Error("Account could not be created");
    return user;
  }

  async createSession(session: typeof authSessions.$inferInsert) {
    await this.database.db.insert(authSessions).values(session);
  }

  findActiveSession(id: string) {
    return this.database.db.query.authSessions.findFirst({
      where: and(
        eq(authSessions.id, id),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async rotateSession(id: string, oldHash: string, newHash: string) {
    // Compare-and-swap: exactly one concurrent refresh can consume a token.
    const [session] = await this.database.db
      .update(authSessions)
      .set({ refreshTokenHash: newHash, updatedAt: new Date() })
      .where(
        and(
          eq(authSessions.id, id),
          eq(authSessions.refreshTokenHash, oldHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date()),
        ),
      )
      .returning({ id: authSessions.id });
    return session;
  }

  async revokeSession(id: string, hash: string) {
    await this.database.db
      .update(authSessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(authSessions.id, id),
          eq(authSessions.refreshTokenHash, hash),
          isNull(authSessions.revokedAt),
        ),
      );
  }
}
