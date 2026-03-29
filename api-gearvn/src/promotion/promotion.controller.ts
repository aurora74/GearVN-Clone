import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { Permission } from 'src/auth/policy/permissions';

import { PromotionService } from './promotion.service';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @Get('summary')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(Permission.PROMOTION_MANAGE)
  @ApiBearerAuth()
  getSummary() {
    return this.promotionService.getSummary();
  }
}
