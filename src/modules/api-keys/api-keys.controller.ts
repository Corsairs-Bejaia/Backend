import { Controller, Post, Get, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CurrentUser } from '@core/decorators/current-user.decorator';

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.apiKeysService.findAll(user.userId);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.apiKeysService.revoke(user.userId, id);
  }
}
