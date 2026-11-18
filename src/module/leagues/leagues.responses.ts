import { ApiProperty } from "@nestjs/swagger";

export class LeagueResponseDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: String, format: "uuid" }) ownerId!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({
    type: String,
    description: "Generated once; stable when the name changes.",
  })
  slug!: string;
  @ApiProperty({ type: String, enum: ["cricket"] }) sport!: string;
  @ApiProperty({ type: String, nullable: true }) location!: string | null;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
}
export class TournamentResponseDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: String, format: "uuid" }) leagueId!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String }) season!: string;
  @ApiProperty({
    type: String,
    enum: ["draft", "open", "live", "completed", "archived"],
  })
  status!: string;
  @ApiProperty({ type: String }) timezone!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  startsAt!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  schedulePublishedAt!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) endsAt!:
    | string
    | null;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
}
export class StaffResponseDto {
  @ApiProperty({ type: String, format: "uuid" }) userId!: string;
  @ApiProperty({ type: String }) username!: string;
  @ApiProperty({ type: String, enum: ["admin", "scorer"] }) role!: string;
}
export class ManagedLeagueResponseDto extends LeagueResponseDto {
  @ApiProperty({ type: String, enum: ["owner", "admin", "scorer"] })
  viewerRole!: "owner" | "admin" | "scorer";
}

export class LeagueListDto {
  @ApiProperty({ type: () => ManagedLeagueResponseDto, isArray: true })
  data!: ManagedLeagueResponseDto[];
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number, enum: [20] }) pageSize!: number;
}
export class TournamentListDto {
  @ApiProperty({ type: () => TournamentResponseDto, isArray: true })
  data!: TournamentResponseDto[];
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number, enum: [20] }) pageSize!: number;
}
export class StaffListDto {
  @ApiProperty({ type: () => StaffResponseDto, isArray: true })
  data!: StaffResponseDto[];
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number, enum: [20] }) pageSize!: number;
}
