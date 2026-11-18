import { ApiProperty } from '@nestjs/swagger';
import { player_role_enum } from '../../db/players';

export class CatalogueTeamDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String, nullable: true }) logo!: string | null;
}

export class CataloguePlayerDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, example: '24', nullable: true }) age!: string | null;
  @ApiProperty({ type: String, enum: player_role_enum.enumValues }) role!: string;
}

export class RosterPlayerDto extends CataloguePlayerDto {
  @ApiProperty({ type: String, format: 'uuid' }) playerId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) teamId!: string;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
}

class PageResponseDto {
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) pageSize!: number;
}

export class CatalogueTeamPageDto extends PageResponseDto {
  @ApiProperty({ type: () => CatalogueTeamDto, isArray: true }) data!: CatalogueTeamDto[];
}

export class CataloguePlayerPageDto extends PageResponseDto {
  @ApiProperty({ type: () => CataloguePlayerDto, isArray: true }) data!: CataloguePlayerDto[];
}

export class RosterPageDto extends PageResponseDto {
  @ApiProperty({ type: () => RosterPlayerDto, isArray: true }) data!: RosterPlayerDto[];
}
