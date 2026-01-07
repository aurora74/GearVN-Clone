import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiParam, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permission } from '../auth/policy/permissions';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { SystemConfigService } from './system-config.service';

@ApiTags('System Config')
@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  @ApiBearerAuth()
  @Permissions(Permission.SYSTEM_CONFIG_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  findAll() {
    return this.systemConfigService.findAll();
  }

  @Patch(':key')
  @ApiBearerAuth()
  @Permissions(Permission.SYSTEM_CONFIG_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiParam({ name: 'key', required: true })
  @ApiBody({ type: UpdateSystemConfigDto })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSystemConfigDto,
    @Request() req,
  ) {
    return this.systemConfigService.updateConfig(req.user, key, dto, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }
}
