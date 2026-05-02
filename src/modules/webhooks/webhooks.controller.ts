import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { CurrentUser } from '@core/decorators/current-user.decorator';

interface JwtUser {
  id: string;
  email: string;
}

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('webhooks/endpoints')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new webhook endpoint' })
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateEndpointDto) {
    return this.webhooks.createEndpoint(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all webhook endpoints' })
  list(@CurrentUser() user: JwtUser) {
    return this.webhooks.listEndpoints(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a webhook endpoint' })
  @ApiParam({ name: 'id' })
  getOne(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.webhooks.getEndpoint(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a webhook endpoint' })
  @ApiParam({ name: 'id' })
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateEndpointDto,
  ) {
    return this.webhooks.updateEndpoint(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  @ApiParam({ name: 'id' })
  async remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    await this.webhooks.deleteEndpoint(user.id, id);
  }

  @Get(':id/secret')
  @ApiOperation({
    summary: 'Get the signing secret for an endpoint',
    description:
      'Use this secret to verify the `svix-signature` header on incoming webhook payloads.',
  })
  @ApiParam({ name: 'id' })
  getSecret(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.webhooks.getEndpointSecret(user.id, id);
  }

  @Post(':id/rotate-secret')
  @ApiOperation({ summary: 'Rotate the signing secret for an endpoint' })
  @ApiParam({ name: 'id' })
  rotateSecret(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.webhooks.rotateEndpointSecret(user.id, id);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'List recent delivery attempts for an endpoint' })
  @ApiParam({ name: 'id' })
  deliveries(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.webhooks.listDeliveries(user.id, id);
  }
}
