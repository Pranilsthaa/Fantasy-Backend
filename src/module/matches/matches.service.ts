import { isNull } from 'drizzle-orm';
import { matches } from '../../db/matches';
import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class MatchesService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  findAll() {
    return this.database.db.query.matches.findMany({
    where: isNull(matches.tournamentId),
    columns: {
      id: true,
      matchNumber: true,
      date: true,
      venue: true,
      status: true,
    },
    with: {
      team1: {
        columns: {
          name: true,
          logo: true,
          code: true,
        }
      },
      team2: {
        columns: {
          name: true,
          logo: true,
          code: true,
        }
      }
    }
  });
  }
}
