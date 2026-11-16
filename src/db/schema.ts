export * from './auth-sessions';
export * from './tournaments';
export * from './statistics';
export * from './fantasy';
export * from './users';
export * from './players';
export * from './teams';
export * from './matches';

import * as usersSchema from './users';
import * as playersSchema from './players';
import * as teamsSchema from './teams';
import * as matchesSchema from './matches';

import * as tournamentSchema from './tournaments';
import * as statisticsSchema from './statistics';
import * as fantasySchema from './fantasy';

import * as authSchema from './auth-sessions';

export const schema = {
  ...authSchema,
  ...tournamentSchema,
  ...statisticsSchema,
  ...fantasySchema,
  ...usersSchema,
  ...playersSchema,
  ...teamsSchema,
  ...matchesSchema,
};
