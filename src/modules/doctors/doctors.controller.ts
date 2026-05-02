import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { CurrentUser } from '@core/decorators/current-user.decorator';

@ApiTags('Doctors')
@ApiBearerAuth()
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new doctor under this tenant' })
  create(
    @Body() dto: CreateDoctorDto,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.doctorsService.create(dto, user.tenantId);
  }

  @Get()
  @ApiOperation({
    summary: 'List doctors for this tenant (paginated, filterable)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Full-text search on name (FR/AR) or NIN',
  })
  findAll(
    @CurrentUser() user: { id: string; tenantId: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.doctorsService.findAll(
      user.tenantId,
      page,
      limit,
      status,
      search,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a doctor by ID (includes last 10 verifications)',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.doctorsService.findOne(id, user.tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update doctor details or status' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDoctorDto,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.doctorsService.update(id, dto, user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a doctor and all associated data' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.doctorsService.remove(id, user.tenantId);
  }
}
