import { ApiProperty, ApiPropertyOptional, type SchemaObject } from '@nestjs/swagger';
import { dismissals, extras, metricNames } from './cricket';

class PublishedResultResponse {
  @ApiProperty({ type: Number }) revision!: number;
  @ApiProperty({ type: String, format: 'date-time' }) publishedAt!: string;
  @ApiProperty({ type: String, enum: ['team_win', 'tie', 'no_result', 'draw'] }) outcome!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) winnerTeamId!: string | null;
}

const id = { type: 'string', format: 'uuid' } as const;
const nullableId = { ...id, nullable: true } as const;
const integer = { type: 'integer' } as const;
const ball: SchemaObject = {
  type: 'object',
  required: ['sequence', 'strikerId', 'nonStrikerId', 'bowlerId', 'over', 'ballInOver', 'legalBall', 'runs', 'batRuns'],
  properties: {
    sequence: integer, strikerId: id, nonStrikerId: id, bowlerId: id, over: integer, ballInOver: integer,
    legalBall: { type: 'boolean' }, runs: integer, batRuns: integer, extraRuns: integer, boundary: integer,
    extra: { type: 'string', enum: [...extras] }, dismissal: { type: 'string', enum: [...dismissals] },
    dismissedPlayerId: id, fielderIds: { type: 'array', items: id },
  },
};

class InningsResponse {
  @ApiProperty({ type: Number }) number!: number;
  @ApiProperty(id) battingTeamId!: string;
  @ApiProperty(id) bowlingTeamId!: string;
  @ApiProperty(nullableId) strikerId!: string | null;
  @ApiProperty(nullableId) nonStrikerId!: string | null;
  @ApiProperty(nullableId) bowlerId!: string | null;
  @ApiProperty(nullableId) previousBowlerId!: string | null;
  @ApiProperty({ type: Number, nullable: true }) target!: number | null;
  @ApiProperty({ type: Number }) runs!: number;
  @ApiProperty({ type: Number }) wickets!: number;
  @ApiProperty({ type: Number }) extras!: number;
  @ApiProperty({ type: Number }) legalBalls!: number;
  @ApiProperty({ type: Boolean }) closed!: boolean;
  @ApiProperty({ type: Boolean }) freeHit!: boolean;
  @ApiProperty({ type: [String] }) usedBatters!: string[];
  @ApiProperty({ type: 'array', items: ball }) balls!: unknown[];
}

export class ScorecardResponse {
  @ApiProperty(id) fixtureId!: string;
  @ApiProperty({ type: Number }) overs!: number;
  @ApiProperty({ type: String }) status!: string;
  @ApiProperty({ type: () => PublishedResultResponse, nullable: true }) official!: PublishedResultResponse | null;
  @ApiProperty({ type: () => InningsResponse, isArray: true }) innings!: InningsResponse[];
  @ApiProperty({ type: 'array', items: {
    type: 'object', properties: { id, teamId: id, name: { type: 'string' },
      ...Object.fromEntries(Object.keys(metricNames).map((key) => [key, integer])) },
  } }) players!: unknown[];
  @ApiPropertyOptional({ type: Number, description: 'Staff only. Supply for the next write.' }) version?: number;
  @ApiPropertyOptional({ type: Boolean, description: 'Staff only. An official scorecard is being corrected.' }) correcting?: boolean;
}

export class ScoreVersionResponse {
  @ApiProperty({ type: Number }) version!: number;
}

export class PublishResultResponse extends PublishedResultResponse {
  @ApiProperty({ type: Number }) version!: number;
}
