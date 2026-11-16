export * from './users';
export * from './players';
export * from './teams';
export * from './matches';

import * as usersSchema from './users';
import * as playersSchema from './players';
import * as teamsSchema from './teams';
import * as matchesSchema from './matches';

export const schema = {
  ...usersSchema,
  ...playersSchema,
  ...teamsSchema,
  ...matchesSchema,
};
