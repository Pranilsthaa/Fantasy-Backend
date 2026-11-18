import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, IsUrl, IsUUID, Length, Matches, Max, Min, ValidateIf } from 'class-validator';
import { player_role_enum } from '../../db/players';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export type CricketRole = (typeof player_role_enum.enumValues)[number];

export class CreateTeamDto {
  @ApiProperty({ type: String, maxLength: 100 })
  @Transform(trim) @IsString() @Length(1, 100) name!: string;

  @ApiProperty({ type: String, example: 'KCC', maxLength: 5 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @Matches(/^[A-Z0-9]{1,5}$/) code!: string;

  @ApiPropertyOptional({ type: String, format: 'uri', nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString() @Length(1, 2048)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  logo?: string | null;
}

export class EditTeamDto extends PartialType(CreateTeamDto, { skipNullProperties: false }) {}

export class CreatePlayerDto {
  @ApiProperty({ type: String, maxLength: 50 })
  @Transform(trim) @IsString() @Length(1, 50) name!: string;

  @ApiProperty({ type: String, enum: player_role_enum.enumValues })
  @IsIn(player_role_enum.enumValues) role!: CricketRole;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 99, nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsInt() @Min(1) @Max(99) age?: number | null;
}

export class EditPlayerDto extends PartialType(CreatePlayerDto, { skipNullProperties: false }) {}

export class RegisterPlayerDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID() teamId!: string;

  @ApiPropertyOptional({ type: String, enum: player_role_enum.enumValues, description: 'Defaults to the player profile role on initial registration.' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(player_role_enum.enumValues) role?: CricketRole;
}
