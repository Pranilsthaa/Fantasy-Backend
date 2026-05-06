import { db, teams, players, users, matches } from './index';
import { exit } from 'process';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // 1. Seed Teams
    console.log('  Inserting teams...');
    const teamsData = [
      { code: "MI",  name: "Mumbai Indians",              logo: "https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/MI/Logos/Roundbig/MIroundbig.png" },
      { code: "CSK", name: "Chennai Super Kings",         logo: "https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/CSK/logos/Roundbig/CSKroundbig.png" },
      { code: "RCB", name: "Royal Challengers Bengaluru", logo: "https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/RCB/Logos/Roundbig/RCBroundbig.png" },
      { code: "KKR", name: "Kolkata Knight Riders",       logo: "https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/KKR/Logos/Roundbig/KKRroundbig.png" },
      { code: "DC",  name: "Delhi Capitals",              logo: "https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/DC/Logos/Roundbig/DCroundbig.png" },
      { code: "PBKS",name: "Punjab Kings",                logo: "https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/PBKS/Logos/Roundbig/PBKSroundbig.png" },
      { code: "RR",  name: "Rajasthan Royals",            logo: "https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/RR/Logos/Roundbig/RRroundbig.png" },
      { code: "SRH", name: "Sunrisers Hyderabad",         logo: "https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/SRH/Logos/Roundbig/SRHroundbig.png" },
      { code: "GT",  name: "Gujarat Titans",              logo: "https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/GT/Logos/Roundbig/GTroundbig.png" },
      { code: "LSG", name: "Lucknow Super Giants",        logo: "https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/LSG/Logos/Roundbig/LSGroundbig.png" },
    ];

    for (const teamData of teamsData) {
      await db.insert(teams).values(teamData).onConflictDoUpdate({
        target: teams.code,
        set: { logo: teamData.logo, name: teamData.name }
      });
    }

    const allTeams = await db.select().from(teams);
    const teamMap = allTeams.reduce((acc, team) => {
      acc[team.code] = team.id;
      return acc;
    }, {} as Record<string, string>);

    // 2. Seed Players (3 per team)
    console.log('  Inserting players...');
    const playersToInsert = [
      // MI
      { name: "Rohit Sharma",       age: "37", price: 10, role: "BAT"        as const, team_id: teamMap["MI"]!,   isActive: true },
      { name: "Jasprit Bumrah",     age: "30", price: 9.5,  role: "BWL"        as const, team_id: teamMap["MI"]!,   isActive: true },
      { name: "Hardik Pandya",      age: "30", price: 8.5,  role: "AR"    as const, team_id: teamMap["MI"]!,   isActive: true },
      // CSK
      { name: "MS Dhoni",           age: "42", price: 9.0,  role: "WK"  as const, team_id: teamMap["CSK"]!,  isActive: true },
      { name: "Ruturaj Gaikwad",    age: "27", price: 7.5,  role: "BAT"        as const, team_id: teamMap["CSK"]!,  isActive: true },
      { name: "Ravindra Jadeja",    age: "35", price: 8.0,  role: "AR"    as const, team_id: teamMap["CSK"]!,  isActive: true },
      // RCB
      { name: "Virat Kohli",        age: "35", price: 9.9,  role: "BAT"        as const, team_id: teamMap["RCB"]!,  isActive: true },
      { name: "Faf du Plessis",     age: "39", price: 7.0,  role: "BAT"        as const, team_id: teamMap["RCB"]!,  isActive: true },
      { name: "Mohammed Siraj",     age: "30", price: 6.5,  role: "BWL"        as const, team_id: teamMap["RCB"]!,  isActive: true },
      // KKR
      { name: "Shreyas Iyer",       age: "29", price: 7.8,  role: "BAT"        as const, team_id: teamMap["KKR"]!,  isActive: true },
      { name: "Andre Russell",      age: "35", price: 8.8,  role: "AR"    as const, team_id: teamMap["KKR"]!,  isActive: true },
      { name: "Sunil Narine",       age: "35", price: 8.2,  role: "AR"    as const, team_id: teamMap["KKR"]!,  isActive: true },
      // DC
      { name: "David Warner",       age: "37", price: 7.2,  role: "BAT"        as const, team_id: teamMap["DC"]!,   isActive: true },
      { name: "Axar Patel",         age: "30", price: 6.8,  role: "AR"    as const, team_id: teamMap["DC"]!,   isActive: true },
      { name: "Kuldeep Yadav",      age: "29", price: 6.5,  role: "BWL"        as const, team_id: teamMap["DC"]!,   isActive: true },
      // PBKS
      { name: "Shikhar Dhawan",     age: "38", price: 6.0,  role: "BAT"        as const, team_id: teamMap["PBKS"]!, isActive: true },
      { name: "Sam Curran",         age: "25", price: 7.4,  role: "AR"    as const, team_id: teamMap["PBKS"]!, isActive: true },
      { name: "Arshdeep Singh",     age: "25", price: 6.6,  role: "BWL"        as const, team_id: teamMap["PBKS"]!, isActive: true },
      // RR
      { name: "Sanju Samson",       age: "29", price: 8.0,  role: "WK"  as const, team_id: teamMap["RR"]!,   isActive: true },
      { name: "Jos Buttler",        age: "33", price: 8.5,  role: "WK"  as const, team_id: teamMap["RR"]!,   isActive: true },
      { name: "Yuzvendra Chahal",   age: "33", price: 7.0,  role: "BWL"        as const, team_id: teamMap["RR"]!,   isActive: true },
      // SRH
      { name: "Pat Cummins",        age: "30", price: 8.7,  role: "BWL"        as const, team_id: teamMap["SRH"]!,  isActive: true },
      { name: "Heinrich Klaasen",   age: "32", price: 7.6,  role: "WK"  as const, team_id: teamMap["SRH"]!,  isActive: true },
      { name: "Travis Head",        age: "30", price: 8.3,  role: "BAT"        as const, team_id: teamMap["SRH"]!,  isActive: true },
      // GT
      { name: "Shubman Gill",       age: "24", price: 8.4,  role: "BAT"        as const, team_id: teamMap["GT"]!,   isActive: true },
      { name: "Rashid Khan",        age: "25", price: 9.1,  role: "BWL"        as const, team_id: teamMap["GT"]!,   isActive: true },
      { name: "Mohammed Shami",     age: "33", price: 7.9,  role: "BWL"        as const, team_id: teamMap["GT"]!,   isActive: true },
      // LSG
      { name: "KL Rahul",           age: "31", price: 8.6,  role: "WK"  as const, team_id: teamMap["LSG"]!,  isActive: true },
      { name: "Nicholas Pooran",    age: "28", price: 7.3,  role: "WK"  as const, team_id: teamMap["LSG"]!,  isActive: true },
      { name: "Ravi Bishnoi",       age: "23", price: 6.2,  role: "BWL"        as const, team_id: teamMap["LSG"]!,  isActive: true },
    ];

    for (const playerData of playersToInsert) {
      const existing = await db.select().from(players).where(eq(players.name, playerData.name)).limit(1);
      if (existing.length === 0) {
        await db.insert(players).values(playerData);
      }
    }

    // 3. Seed Users
    console.log('  Inserting users...');
    const usersToInsert = [
      { username: "admin_user", email: "admin@example.com", passwordHash: "hashed_password_123", role: "admin" as const },
      { username: "johndoe",    email: "john@example.com",  passwordHash: "hashed_password_456", role: "user"  as const },
    ];

    for (const userData of usersToInsert) {
      await db.insert(users).values(userData).onConflictDoNothing();
    }

    // 4. Seed Matches (each team plays at least once)
    console.log('  Inserting matches...');
    const matchesToInsert = [
      { matchNumber: 1,  team1_id: teamMap["MI"]!,   team2_id: teamMap["CSK"]!,  venue: "Wankhede Stadium",         date: new Date("2026-04-22T19:30:00Z"), status: "upcoming" as const },
      { matchNumber: 2,  team1_id: teamMap["RCB"]!,  team2_id: teamMap["KKR"]!,  venue: "M. Chinnaswamy Stadium",   date: new Date("2026-04-23T14:00:00Z"), status: "upcoming" as const },
      { matchNumber: 3,  team1_id: teamMap["DC"]!,   team2_id: teamMap["PBKS"]!, venue: "Arun Jaitley Stadium",     date: new Date("2026-04-23T19:30:00Z"), status: "upcoming" as const },
      { matchNumber: 4,  team1_id: teamMap["RR"]!,   team2_id: teamMap["SRH"]!,  venue: "Sawai Mansingh Stadium",   date: new Date("2026-04-24T19:30:00Z"), status: "upcoming" as const },
      { matchNumber: 5,  team1_id: teamMap["GT"]!,   team2_id: teamMap["LSG"]!,  venue: "Narendra Modi Stadium",    date: new Date("2026-04-25T19:30:00Z"), status: "upcoming" as const },
      { matchNumber: 6,  team1_id: teamMap["CSK"]!,  team2_id: teamMap["RCB"]!,  venue: "Chepauk Stadium",          date: new Date("2026-04-26T19:30:00Z"), status: "upcoming" as const },
      { matchNumber: 7,  team1_id: teamMap["KKR"]!,  team2_id: teamMap["MI"]!,   venue: "Eden Gardens",             date: new Date("2026-04-27T19:30:00Z"), status: "upcoming" as const },
      { matchNumber: 8,  team1_id: teamMap["SRH"]!,  team2_id: teamMap["GT"]!,   venue: "Rajiv Gandhi Stadium",     date: new Date("2026-04-28T19:30:00Z"), status: "upcoming" as const },
      { matchNumber: 9,  team1_id: teamMap["LSG"]!,  team2_id: teamMap["DC"]!,   venue: "BRSABV Ekana Stadium",     date: new Date("2026-04-29T19:30:00Z"), status: "upcoming" as const },
      { matchNumber: 10, team1_id: teamMap["PBKS"]!, team2_id: teamMap["RR"]!,   venue: "New PCA Stadium",          date: new Date("2026-04-30T19:30:00Z"), status: "upcoming" as const },
    ];

    for (const matchData of matchesToInsert) {
      await db.insert(matches).values(matchData).onConflictDoNothing();
    }

    console.log('✅ Seeding completed successfully!');
    exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    exit(1);
  }
}

seed();