import { ValidationPipe, type Type } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const normalized = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const REFRESH_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[0-9a-f]{64}$/;

export class RegisterDto {
  @Transform(normalized)
  @IsString()
  @Matches(/^[a-z0-9_]{3,30}$/)
  username!: string;

  @Transform(normalized)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class LoginDto {
  @Transform(normalized)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class RefreshTokenDto {
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
