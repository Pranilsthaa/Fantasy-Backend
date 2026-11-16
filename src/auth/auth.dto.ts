import { ValidationPipe, type Type } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const normalized = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const REFRESH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[0-9a-f]{64}$/;

export class RegisterDto {
  @ApiProperty({
    type: String,
    minLength: 3,
    maxLength: 30,
    pattern: "^[a-z0-9_]{3,30}$",
    example: "manager",
    description: "Trimmed and lowercased before validation.",
  })
  @Transform(normalized)
  @IsString()
  @Matches(/^[a-z0-9_]{3,30}$/)
  username!: string;

  @ApiProperty({
    type: String,
    format: "email",
    maxLength: 254,
    example: "manager@example.test",
    description: "Trimmed and lowercased.",
  })
  @Transform(normalized)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    type: String,
    format: "password",
    writeOnly: true,
    minLength: 12,
    maxLength: 128,
    description:
      "A passphrase of 12–128 characters. Whitespace and case are preserved.",
  })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @ApiProperty({
    type: String,
    format: "email",
    maxLength: 254,
    example: "manager@example.test",
    description: "Trimmed and lowercased.",
  })
  @Transform(normalized)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    type: String,
    format: "password",
    writeOnly: true,
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    type: String,
    format: "password",
    writeOnly: true,
    minLength: 101,
    maxLength: 101,
    pattern: REFRESH_PATTERN.source,
    description:
      "The latest opaque refresh credential returned by register, login or refresh.",
  })
  @IsString()
  @MaxLength(101)
  @Matches(REFRESH_PATTERN)
  refreshToken!: string;
}

// Explicit expectedType also validates Bun source runs, which do not emit
// TypeScript's design:paramtypes metadata.
export function authBody(type: Type<object>) {
  return new ValidationPipe({
    expectedType: type,
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    validationError: { target: false, value: false },
  });
}
