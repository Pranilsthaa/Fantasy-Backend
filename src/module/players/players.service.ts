import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class PlayersService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  findAll() {
    return this.database.db.query.players.findMany({
    columns: {
      id: true,
      name: true,
      age: true,
      price: true,
      role: true,
      isActive: true,
    },
    with: {
      team: {
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
