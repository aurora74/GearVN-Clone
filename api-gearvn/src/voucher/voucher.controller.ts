import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permission } from '../auth/policy/permissions';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { ValidateVoucherDto } from './dto/validate-voucher.dto';
import { VoucherService } from './voucher.service';

@ApiTags('Vouchers')
@Controller('vouchers')
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  @Get('public')
  publicVouchers() {
    return this.voucherService.listPublic();
  }

  @Post('validate')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        subtotal: { type: 'number' },
      },
      required: ['code', 'subtotal'],
    },
  })
  validate(@Body() body: ValidateVoucherDto) {
    return this.voucherService.validatePublic(body.code, body.subtotal);
  }

  @Get()
  @ApiBearerAuth()
  @Permissions(Permission.PROMOTION_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.voucherService.findAll({ page, limit, search });
  }

  @Get(':id')
  @ApiBearerAuth()
  @Permissions(Permission.PROMOTION_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiParam({ name: 'id', required: true })
  findOne(@Param('id') id: string) {
    return this.voucherService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @Permissions(Permission.PROMOTION_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiBody({ type: CreateVoucherDto })
  create(@Body() dto: CreateVoucherDto, @Request() req: any) {
    return this.voucherService.create(dto, req.user, this.requestContext(req));
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Permissions(Permission.PROMOTION_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiParam({ name: 'id', required: true })
  @ApiBody({ type: UpdateVoucherDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVoucherDto,
    @Request() req: any,
  ) {
    return this.voucherService.update(id, dto, req.user, this.requestContext(req));
  }

  @Patch(':id/enable')
  @ApiBearerAuth()
  @Permissions(Permission.PROMOTION_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiParam({ name: 'id', required: true })
  enable(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    return this.voucherService.enable(
      id,
      req.user,
      body?.reason,
      this.requestContext(req),
    );
  }

  @Patch(':id/disable')
  @ApiBearerAuth()
  @Permissions(Permission.PROMOTION_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiParam({ name: 'id', required: true })
  disable(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    return this.voucherService.disable(
      id,
      req.user,
      body?.reason,
      this.requestContext(req),
    );
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Permissions(Permission.PROMOTION_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiParam({ name: 'id', required: true })
  remove(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any,
  ) {
    return this.voucherService.remove(
      id,
      req.user,
      body?.reason,
      this.requestContext(req),
    );
  }

  private requestContext(req: any) {
    return {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    };
  }
}
