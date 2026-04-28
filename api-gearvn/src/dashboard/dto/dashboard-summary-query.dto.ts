import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsIn, IsOptional } from 'class-validator';

export class DashboardSummaryQueryDto {
  @ApiPropertyOptional({ enum: ['7d', '30d', '90d', 'custom'] })
  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'custom'])
  preset?: '7d' | '30d' | '90d' | 'custom';

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
