import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permission } from '../auth/policy/permissions';
import { SupportTicketStatus } from './support-ticket.schema';
import { SupportTicketService } from './support-ticket.service';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';

@ApiTags('Support Tickets')
@ApiBearerAuth()
@Controller('support-tickets')
@UseGuards(JwtGuard, PermissionsGuard)
@Permissions(Permission.CSR_SUPPORT_MANAGE)
export class SupportTicketController {
  constructor(private readonly supportTicketService: SupportTicketService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(
    @Query('status') status?: SupportTicketStatus,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.supportTicketService.list({ status, page, limit });
  }

  @Get(':id')
  @ApiParam({ name: 'id', required: true })
  findOne(@Param('id') id: string) {
    return this.supportTicketService.findOne(id);
  }

  @Patch(':id/status')
  @ApiParam({ name: 'id', required: true })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketStatusDto,
  ) {
    return this.supportTicketService.updateStatus(id, dto.status);
  }
}
