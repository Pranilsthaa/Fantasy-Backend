import { ApiProperty, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";

export class CreateFixtureDto {
  @ApiProperty({ type: "integer", minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  matchNumber!: number;

  @ApiProperty({ type: String, format: "uuid" })
  @IsUUID()
  team1Id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  @IsUUID()
  team2Id!: string;

  @ApiProperty({ type: String, maxLength: 50 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 50)
  venue!: string;

  @ApiProperty({
    type: String,
    format: "date-time",
    description: "Timestamp with explicit timezone.",
  })
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  date!: string;
}

export class EditFixtureDto extends PartialType(CreateFixtureDto, {
  skipNullProperties: false,
}) {}

export class FixtureStatusDto {
  @ApiProperty({ type: String, enum: ["live", "cancelled"] })
  @IsIn(["live", "cancelled"])
  status!: "live" | "cancelled";
}

class FixtureTeamDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) code!: string;
  @ApiProperty({ type: String, nullable: true }) logo!: string | null;
}

export class FixtureDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: Number }) matchNumber!: number;
  @ApiProperty({ type: String }) venue!: string;
  @ApiProperty({ type: String, format: "date-time" }) date!: string;
  @ApiProperty({
    type: String,
    enum: ["upcoming", "locked", "live", "completed", "cancelled"],
  })
  status!: string;
  @ApiProperty({ type: Boolean }) hasScorecard!: boolean;
  @ApiProperty({ type: () => FixtureTeamDto }) team1!: FixtureTeamDto;
  @ApiProperty({ type: () => FixtureTeamDto }) team2!: FixtureTeamDto;
}

export class ScheduleDto {
  @ApiProperty({ type: String, format: "uuid" }) tournamentId!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) timezone!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  publishedAt!: string | null;
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) pageSize!: number;
  @ApiProperty({ type: () => FixtureDto, isArray: true }) data!: FixtureDto[];
}

export class PublishedScheduleDto {
  @ApiProperty({ type: String, format: "date-time" }) publishedAt!: string;
}
