import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { Permission } from 'src/auth/policy/permissions';

import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(Permission.DASHBOARD_VIEW)
  @ApiBearerAuth()
  getSummary() {
    return this.dashboardService.getSummary();
  }
}
