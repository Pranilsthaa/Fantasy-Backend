import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicUserDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, example: 'manager' }) username!: string;
  @ApiProperty({ type: String, format: 'email', example: 'manager@example.test' }) email!: string;
  @ApiProperty({ type: String, enum: ['user', 'admin'] }) role!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class AuthTokensResponseDto {
  @ApiProperty({ type: () => PublicUserDto }) user!: PublicUserDto;
  @ApiProperty({ type: String, enum: ['Bearer'] }) tokenType!: string;
  @ApiProperty({ type: String, description: 'Short-lived JWT. Use it in the Authorization header.', readOnly: true }) accessToken!: string;
  @ApiProperty({ type: Number, example: 900, description: 'Maximum access-token lifetime in seconds; the session deadline can end access sooner.' }) expiresIn!: number;
  @ApiProperty({ type: String, description: 'Opaque credential. Replaced by every successful refresh; retain the latest value.', readOnly: true }) refreshToken!: string;
  @ApiProperty({ type: String, format: 'date-time', description: 'Absolute session deadline; refreshing does not extend it.' }) refreshExpiresAt!: string;
}

export class ProfileResponseDto {
  @ApiProperty({ type: () => PublicUserDto }) user!: PublicUserDto;
}

export class ApiErrorDto {
  @ApiProperty({ type: Number, example: 401 }) statusCode!: number;
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'An error message, or a list of validation failures.' }) message!: string | string[];
  @ApiPropertyOptional({ type: String, example: 'Unauthorized' }) error?: string;
}

export class ApiFailureDto {
  @ApiProperty({ type: Boolean, enum: [false] }) success!: boolean;
  @ApiProperty({ type: String, example: 'Internal server error' }) message!: string;
}

export class DatabaseHealthDto {
  @ApiProperty({ type: String, enum: ['ok'] }) status!: string;
  @ApiProperty({ type: String, enum: ['connected'] }) database!: string;
}

export class DatabaseUnavailableDto {
  @ApiProperty({ type: String, enum: ['error'] }) status!: string;
  @ApiProperty({ type: String, enum: ['unavailable'] }) database!: string;
}

export class TeamSummaryDto {
  @ApiProperty({ type: String, example: 'Local Cricket Club' }) name!: string;
  @ApiProperty({ type: String, description: 'Team logo location.' }) logo!: string;
  @ApiProperty({ type: String, example: 'LCC' }) code!: string;
}

export class PlayerSummaryDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, nullable: true, example: '25' }) age!: string | null;
  @ApiProperty({ type: 'integer', description: 'Legacy global player price; tournament-specific registration prices are separate.' }) price!: number;
  @ApiProperty({ type: String, enum: ['BAT', 'BWL', 'AR', 'WK'] }) role!: string;
  @ApiProperty({ type: Boolean }) isActive!: boolean;
  @ApiProperty({ type: () => TeamSummaryDto }) team!: TeamSummaryDto;
}

export class PlayersResponseDto {
  @ApiProperty({ type: Boolean, enum: [true] }) success!: boolean;
  @ApiProperty({ type: String, example: 'Players fetched successfully' }) message!: string;
  @ApiProperty({ type: () => PlayerSummaryDto, isArray: true }) data!: PlayerSummaryDto[];
}

export class MatchSummaryDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: 'integer' }) matchNumber!: number;
  @ApiProperty({ type: String, format: 'date-time' }) date!: string;
  @ApiProperty({ type: String }) venue!: string;
  @ApiProperty({ type: String, enum: ['upcoming', 'locked', 'live', 'completed', 'cancelled'] }) status!: string;
  @ApiProperty({ type: () => TeamSummaryDto }) team1!: TeamSummaryDto;
  @ApiProperty({ type: () => TeamSummaryDto }) team2!: TeamSummaryDto;
}

export class MatchesResponseDto {
  @ApiProperty({ type: Boolean, enum: [true] }) success!: boolean;
  @ApiProperty({ type: String, example: 'Matches fetched successfully' }) message!: string;
  @ApiProperty({ type: () => MatchSummaryDto, isArray: true }) data!: MatchSummaryDto[];
}
