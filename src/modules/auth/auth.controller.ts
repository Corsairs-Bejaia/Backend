import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { Public } from '@core/decorators/public.decorator';
import { CurrentUser } from '@core/decorators/current-user.decorator';

const TOKEN_PAIR_EXAMPLE = {
  accessToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjbHg5MDAxIn0.abc',
  refreshToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjbHg5MDAxIn0.xyz',
};

const ME_EXAMPLE = {
  id: 'clx9usr00001',
  email: 'admin@doctome.dz',
  companyName: 'DoctomeDZ',
  planTier: 'free',
  createdAt: '2026-01-10T08:00:00.000Z',
};

const ENVELOPE = (data: unknown) => ({ success: true, data });

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Register ──────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a new tenant account',
    description:
      'Creates a new User (tenant) with the provided credentials and company name. ' +
      'Returns a JWT access + refresh token pair so the client can immediately ' +
      'start making authenticated requests.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Account created — returns token pair',
    schema: { example: ENVELOPE(TOKEN_PAIR_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email address is already registered',
    schema: {
      example: {
        statusCode: 409,
        message: 'Email already in use',
        error: 'Conflict',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error (invalid email, password too short, etc.)',
    schema: {
      example: {
        statusCode: 400,
        message: ['password must be longer than or equal to 8 characters'],
        error: 'Bad Request',
      },
    },
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate with email + password',
    description:
      'Validates credentials via the Passport `local` strategy and returns a ' +
      'JWT access token (short-lived) and a refresh token (long-lived). ' +
      'Pass the access token as `Authorization: Bearer <token>` on subsequent requests.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Credentials valid — returns token pair',
    schema: { example: ENVELOPE(TOKEN_PAIR_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid email or password',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  // LoginDto used only for Swagger body documentation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  login(@Request() req: { user: User }, @Body() _dto: LoginDto) {
    return this.authService.login(req.user);
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new access token',
    description:
      'Validates the provided refresh token and issues a new short-lived access token. ' +
      'The refresh token itself is **not** rotated.',
  })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refresh successful — returns new access token',
    schema: {
      example: ENVELOPE({ accessToken: TOKEN_PAIR_EXAMPLE.accessToken }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Refresh token is invalid or expired',
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid or expired refresh token',
        error: 'Unauthorized',
      },
    },
  })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // ── Me ────────────────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({
    summary: 'Get the authenticated tenant profile',
    description:
      'Returns the public fields of the currently authenticated User/tenant. ' +
      'Useful for bootstrapping the frontend after login.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tenant profile',
    schema: { example: ENVELOPE(ME_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  me(@CurrentUser() user: { userId: string }) {
    return this.authService.getMe(user.userId);
  }
}
