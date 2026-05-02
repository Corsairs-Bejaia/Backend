import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CurrentUser } from '@core/decorators/current-user.decorator';

const KEY_EXAMPLE = {
  id: 'clx9key00001',
  name: 'Production Key',
  keyPrefix: 'ib_',
  permissions: ['verifications:read', 'verifications:write'],
  rateLimit: 100,
  isActive: true,
  lastUsedAt: null,
  createdAt: '2026-01-15T10:00:00.000Z',
};

// The raw API key is only returned once at creation time and is never stored.
const CREATE_RESPONSE_EXAMPLE = {
  ...KEY_EXAMPLE,
  rawKey: 'ib_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
};

const ENVELOPE = (data: unknown) => ({ success: true, data });

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  // ── Create ────────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Create a new API key',
    description:
      'Generates a new API key for the authenticated tenant. ' +
      'The full raw key is **only returned once** in this response — it is not stored ' +
      'in plain text. Store it securely immediately.\n\n' +
      'Pass the key as `x-api-key: <rawKey>` on server-to-server requests.',
  })
  @ApiBody({ type: CreateApiKeyDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Key created — includes the raw key (one-time)',
    schema: { example: ENVELOPE(CREATE_RESPONSE_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error',
    schema: {
      example: {
        statusCode: 400,
        message: ['name must be longer than or equal to 2 characters'],
        error: 'Bad Request',
      },
    },
  })
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(user.userId, dto);
  }

  // ── List ──────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List all API keys for the authenticated tenant',
    description:
      'Returns metadata for all keys — the raw key value is **never** returned here.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Array of API key metadata',
    schema: { example: ENVELOPE([KEY_EXAMPLE]) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  findAll(@CurrentUser() user: { userId: string }) {
    return this.apiKeysService.findAll(user.userId);
  }

  // ── Revoke ────────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke (delete) an API key',
    description:
      'Permanently deletes the API key. Any in-flight requests using this key ' +
      'will immediately start receiving 401 responses.',
  })
  @ApiParam({
    name: 'id',
    description: 'CUID of the API key to revoke',
    example: 'clx9key00001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Key revoked',
    schema: { example: ENVELOPE({ id: 'clx9key00001', isActive: false }) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Key not found or does not belong to this tenant',
    schema: {
      example: {
        statusCode: 404,
        message: 'API key not found',
        error: 'Not Found',
      },
    },
  })
  revoke(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.apiKeysService.revoke(user.userId, id);
  }
}
