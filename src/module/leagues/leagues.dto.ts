import { ValidationPipe, type Type } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsISO8601,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class CreateLeagueDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 150 })
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiPropertyOptional({ type: String, maxLength: 200 })
  @ValidateIf((_o, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  location?: string;
}
export class UpdateLeagueDto extends PartialType(CreateLeagueDto, {
  skipNullProperties: false,
}) {}

export class SetStaffDto {
  @ApiProperty({
    type: String,
    description: "Existing registered username (case-insensitive).",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Length(1, 50)
  username!: string;

  @ApiProperty({ type: String, enum: ["admin", "scorer"] })
  @IsIn(["admin", "scorer"])
  role!: "admin" | "scorer";
}

export class CreateTournamentDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 150 })
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiProperty({ type: String, minLength: 1, maxLength: 50, example: "2026" })
  @Transform(trim)
  @IsString()
  @Length(1, 50)
  season!: string;

  @ApiPropertyOptional({
    type: String,
    default: "Asia/Kathmandu",
    description: "IANA timezone.",
  })
  @ValidateIf((_o, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  timezone?: string;

  @ApiPropertyOptional({
    type: String,
    format: "date-time",
    description: "ISO timestamp with explicit timezone.",
  })
  @ValidateIf((_o, value) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt?: string;

  @ApiPropertyOptional({ type: String, format: "date-time" })
  @ValidateIf((_o, value) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt?: string;
}
export class UpdateTournamentDto extends PartialType(CreateTournamentDto, {
  skipNullProperties: false,
}) {}

export class PageDto {
  @ApiPropertyOptional({
    type: String,
    pattern: "^[1-9][0-9]{0,5}$",
    default: "1",
  })
  @ValidateIf((_o, value) => value !== undefined)
  @Matches(/^[1-9][0-9]{0,5}$/)
  page?: string;
}

export function leagueInput(type: Type<object>) {
  return new ValidationPipe({
    expectedType: type,
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    validationError: { target: false, value: false },
  });
}
