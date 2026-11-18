import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsIn, IsInt, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import { dismissals, extras, type Delivery } from './cricket';

const normalizeId = ({ value }: { value: unknown }) => typeof value === 'string' ? value.toLowerCase() : value;
const normalizeIds = ({ value }: { value: unknown }) => Array.isArray(value) ? value.map((item) => normalizeId({ value: item })) : value;
const optional = (_object: unknown, value: unknown) => value !== undefined;

export class SetLineupsDto {
  @ApiProperty({ type: Number, minimum: 1, maximum: 50 })
  @IsInt() @Min(1) @Max(50) overs!: number;

  @ApiProperty({ type: [String], description: 'Team 1 tournament player registration IDs.' })
  @ArrayMinSize(2) @ArrayMaxSize(11) @ArrayUnique() @IsUUID(undefined, { each: true })
  team1!: string[];

  @ApiProperty({ type: [String], description: 'Team 2 tournament player registration IDs.' })
  @ArrayMinSize(2) @ArrayMaxSize(11) @ArrayUnique() @IsUUID(undefined, { each: true })
  team2!: string[];
}

export class ScoreVersionDto {
  @ApiProperty({ type: Number, description: 'The version from the last staff scorecard response.' })
  @IsInt() @Min(0) @Max(2147483646) version!: number;
}

export class StartInningsDto extends ScoreVersionDto {
  @ApiProperty({ type: String, format: 'uuid' }) @Transform(normalizeId) @IsUUID() teamId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) @Transform(normalizeId) @IsUUID() strikerId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) @Transform(normalizeId) @IsUUID() nonStrikerId!: string;
}

export class SelectPlayerDto extends ScoreVersionDto {
  @ApiProperty({ type: String, format: 'uuid' }) @Transform(normalizeId) @IsUUID() playerId!: string;
}

export class DeliveryDto extends ScoreVersionDto {
  @ApiProperty({ type: Number, minimum: 0, maximum: 8 })
  @IsInt() @Min(0) @Max(8) batRuns!: number;

  @ApiPropertyOptional({ type: String, enum: extras })
  @ValidateIf(optional) @IsIn(extras) extra?: Delivery['extra'];

  @ApiPropertyOptional({ type: Number, description: 'Additional extras, excluding the automatic wide or no-ball penalty.' })
  @ValidateIf(optional) @IsInt() @Min(0) @Max(8) extraRuns?: number;

  @ApiPropertyOptional({ type: Number, enum: [4, 6] })
  @ValidateIf(optional) @IsIn([4, 6]) boundary?: 4 | 6;

  @ApiPropertyOptional({ type: String, enum: dismissals })
  @ValidateIf(optional) @IsIn(dismissals) dismissal?: Delivery['dismissal'];

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @ValidateIf(optional) @Transform(normalizeId) @IsUUID() dismissedPlayerId?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 2 })
  @ValidateIf(optional) @Transform(normalizeIds) @ArrayMaxSize(2) @ArrayUnique() @IsUUID(undefined, { each: true })
  fielderIds?: string[];
}

export class PublishResultDto extends ScoreVersionDto {
  @ApiPropertyOptional({ type: String, enum: ['no_result'], description: 'Use when a match has been abandoned.' })
  @ValidateIf(optional) @IsIn(['no_result']) outcome?: 'no_result';
}
