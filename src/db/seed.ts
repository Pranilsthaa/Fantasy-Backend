import { db, teams, players, users } from './index';
import { exit } from 'process';
import { eq, or } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // 1. Seed Teams
    console.log('  Inserting teams...');
    for (const teamData of [
      {
        code: "MI",
        name: "Mumbai Indians",
        logo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQTgNMYj3dia5BSOLrdqDdxgThHuwuP0L8f5JhSAEOp5BGZVTJSU1GA9nsGlbPfCwOC1xwOg&s"
      },
      {
        code: "CSK",
        name: "Chennai Super Kings",
        logo: "ss"
      },
      {
        code: "RCB",
        name: "Royal Challengers Bangalore",
        logo: "ss"
      }
    ]) {
      await db.insert(teams).values(teamData).onConflictDoUpdate({
        target: teams.code,
        set: { logo: teamData.logo, name: teamData.name }
      });
    }

    // Fetch all teams to get their IDs
    const allTeams = await db.select().from(teams);
    const teamMap = allTeams.reduce((acc, team) => {
      acc[team.code] = team.id;
      return acc;
    }, {} as Record<string, string>);

    // 2. Seed Players
    console.log('  Inserting players...');
    const playersToInsert = [
      {
        name: "Rohit Sharma",
        age: "36",
        price: 100,
        role: "Batter" as const,
        team_id: teamMap["MI"]!,
        isActive: true
      },
      {
        name: 'Virat Kohli',
        age: "35",
        price: 99,
        role: "Batter" as const,
        team_id: teamMap["RCB"]!,
        isActive: true
      },
      {
        name: 'Rahul Chahar',
        age: "24",
        price: 20,
        role: "Bowler" as const,
        team_id: teamMap["MI"]!,
        isActive: true
      }
    ];

    for (const playerData of playersToInsert) {
      // Check if player exists to avoid duplicates (players table doesn't have unique constraint)
      const existing = await db.select().from(players).where(eq(players.name, playerData.name)).limit(1);
      if (existing.length === 0) {
        await db.insert(players).values(playerData);
      }
    }

    // 3. Seed Users
    console.log('  Inserting users...');
    const usersToInsert = [
      {
        username: "admin_user",
        email: "admin@example.com",
        passwordHash: "hashed_password_123",
        role: "admin" as const,
      },
      {
        username: "johndoe",
        email: "john@example.com",
        passwordHash: "hashed_password_456",
        role: "user" as const,
      }
    ];

    for (const userData of usersToInsert) {
        await db.insert(users).values(userData).onConflictDoNothing();
    }

    console.log('✅ Seeding completed successfully!');
    exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    exit(1);
  }
}

seed();
