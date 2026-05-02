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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { CurrentUser } from '@core/decorators/current-user.decorator';

const DOCTOR_EXAMPLE = {
  id: 'clx9doc00001',
  tenantId: 'clx9usr00001',
  fullNameFr: 'Ahmed Benali',
  fullNameAr: 'أحمد بن علي',
  nationalIdNumber: '198501234567890123',
  specialty: null,
  status: 'active',
  createdAt: '2026-02-01T08:00:00.000Z',
  updatedAt: '2026-02-01T08:00:00.000Z',
};

const ENVELOPE = (data: unknown) => ({ success: true, data });

@ApiTags('Doctors')
@ApiBearerAuth()
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  // ── Create ────────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Register a new doctor under this tenant',
    description:
      'Creates a Doctor record linked to the authenticated tenant. ' +
      'The `nationalIdNumber` must be exactly 18 digits (Algerian NIN format).',
  })
  @ApiBody({ type: CreateDoctorDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Doctor created',
    schema: { example: ENVELOPE(DOCTOR_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation error (e.g. NIN not 18 digits)',
    schema: {
      example: {
        statusCode: 400,
        message: ['nationalIdNumber must be exactly 18 digits'],
        error: 'Bad Request',
      },
    },
  })
  create(
    @Body() dto: CreateDoctorDto,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.doctorsService.create(dto, user.tenantId);
  }

  // ── List ──────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List doctors for this tenant (paginated, filterable)',
    description:
      'Returns a paginated list of doctors belonging to the authenticated tenant. ' +
      'Use `status` to filter by `active` / `inactive` / `suspended`. ' +
      'Use `search` for a full-text match on `fullNameFr`, `fullNameAr`, or `nationalIdNumber`.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'inactive', 'suspended'],
    description: 'Filter by doctor status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Full-text search on name (FR/AR) or NIN',
    example: 'Benali',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated doctor list',
    schema: {
      example: ENVELOPE({
        items: [DOCTOR_EXAMPLE],
        total: 42,
        page: 1,
        limit: 20,
        totalPages: 3,
      }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
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

  // ── Get one ───────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Get a doctor by ID',
    description:
      'Returns the doctor profile including the last 10 verifications.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the doctor',
    example: 'clx9doc00001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Doctor profile with recent verifications',
    schema: {
      example: ENVELOPE({
        ...DOCTOR_EXAMPLE,
        verifications: [
          {
            id: 'clx9vrf00002',
            status: 'completed',
            decision: 'approved',
            score: 0.92,
            startedAt: '2026-04-10T09:00:00.000Z',
            completedAt: '2026-04-10T09:01:00.000Z',
          },
        ],
      }),
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Doctor not found or does not belong to this tenant',
    schema: {
      example: {
        statusCode: 404,
        message: 'Doctor not found',
        error: 'Not Found',
      },
    },
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.doctorsService.findOne(id, user.tenantId);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  @Put(':id')
  @ApiOperation({
    summary: 'Update doctor details or status',
    description:
      'Partial update — only fields present in the request body are changed.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the doctor',
    example: 'clx9doc00001',
  })
  @ApiBody({ type: UpdateDoctorDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Updated doctor',
    schema: { example: ENVELOPE({ ...DOCTOR_EXAMPLE, status: 'inactive' }) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Doctor not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Doctor not found',
        error: 'Not Found',
      },
    },
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDoctorDto,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.doctorsService.update(id, dto, user.tenantId);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a doctor and all associated data',
    description:
      'Hard-deletes the doctor record together with all linked verifications, ' +
      'documents, audit logs, and webhook deliveries (cascade).',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the doctor',
    example: 'clx9doc00001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Doctor deleted',
    schema: { example: ENVELOPE(DOCTOR_EXAMPLE) },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing or invalid Bearer token',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Doctor not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Doctor not found',
        error: 'Not Found',
      },
    },
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    return this.doctorsService.remove(id, user.tenantId);
  }
}
