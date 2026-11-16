import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import {
  ApiErrorDto,
  AuthTokensResponseDto,
  ProfileResponseDto,
} from "../documentation/response.dto";
import { CurrentUser, Public } from "./auth.decorators";
import { authBody, LoginDto, RefreshTokenDto, RegisterDto } from "./auth.dto";
import { AuthService } from "./auth.service";
import { publicUser, type AuthenticatedUser } from "./auth.types";

@ApiTags("Authentication")
@ApiResponse({
  status: 400,
  description: "Invalid input or unexpected fields.",
  type: ApiErrorDto,
})
@ApiResponse({
  status: 429,
  description: "Rate limit exceeded. Retry-After specifies seconds to wait.",
  type: ApiErrorDto,
})
@Controller("api/auth")
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @ApiOperation({
    summary: "Register a fantasy manager",
    description:
      "Creates a regular user and a seven-day session. Limited to 5 attempts per minute per IP.",
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: "Account and session created.",
    type: AuthTokensResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: "Email or username is already registered (case-insensitive).",
    type: ApiErrorDto,
  })
  @Post("register")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  register(@Body(authBody(RegisterDto)) body: RegisterDto) {
    return this.auth.register(body);
  }

  @Public()
  @ApiOperation({
    summary: "Log in with email and password",
    description:
      "Creates a new session. Limited to 10 attempts per minute per IP.",
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: "Login successful.",
    type: AuthTokensResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Invalid email or password.",
    type: ApiErrorDto,
  })
  @Post("login")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  login(@Body(authBody(LoginDto)) body: LoginDto) {
    return this.auth.login(body);
  }

  @Public()
  @ApiOperation({
    summary: "Rotate a refresh credential",
    description:
      "Use the latest refreshToken, not a bearer JWT. Each credential is single-use. Serialize refresh requests; the absolute seven-day session deadline is unchanged. Limited to 30 attempts per minute per IP.",
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: "Replacement credentials. Save the new refreshToken.",
    type: AuthTokensResponseDto,
  })
  @ApiResponse({
    status: 401,
    description:
      "Refresh credential is expired, revoked, unknown or already consumed.",
    type: ApiErrorDto,
  })
  @Post("refresh")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  refresh(@Body(authBody(RefreshTokenDto)) body: RefreshTokenDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @ApiOperation({
    summary: "Log out of the current session",
    description:
      "Use the latest refreshToken. Revokes this session and its access JWTs immediately. Repeated logout returns 204. Other device sessions remain active. Limited to 30 attempts per minute per IP.",
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 204, description: "Logged out; no response body." })
  @Post("logout")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  logout(@Body(authBody(RefreshTokenDto)) body: RefreshTokenDto) {
    return this.auth.logout(body.refreshToken);
  }

  @ApiOperation({
    summary: "Get the authenticated profile",
    description:
      "Requires an access JWT and an active database session. Limited to 60 requests per minute per IP.",
  })
  @ApiBearerAuth("access-token")
  @ApiResponse({
    status: 200,
    description:
      "Current account profile; no password hashes or session internals.",
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid JWT, or expired/revoked session.",
    type: ApiErrorDto,
  })
  @Get("me")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user: publicUser(user) };
  }
}
