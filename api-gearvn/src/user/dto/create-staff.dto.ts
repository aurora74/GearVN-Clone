import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  MinLength,
} from 'class-validator';

import { UserRole } from '../../auth/enums/user-role.enum';

export const STAFF_ASSIGNABLE_ROLES = [
  UserRole.PRODUCT_MARKETING_STAFF,
  UserRole.SALES_OPERATIONS_STAFF,
  UserRole.CSR,
] as const;

export class CreateStaffDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  fullName: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'Password must include uppercase, lowercase, number and special character',
    },
  )
  password: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ enum: STAFF_ASSIGNABLE_ROLES })
  @IsIn(STAFF_ASSIGNABLE_ROLES)
  role: (typeof STAFF_ASSIGNABLE_ROLES)[number];
}
