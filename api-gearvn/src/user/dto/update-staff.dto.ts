import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

import { STAFF_ASSIGNABLE_ROLES } from './create-staff.dto';

export class UpdateStaffDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: STAFF_ASSIGNABLE_ROLES })
  @IsOptional()
  @IsIn(STAFF_ASSIGNABLE_ROLES)
  role?: (typeof STAFF_ASSIGNABLE_ROLES)[number];
}
