import {
  IsEnum,
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsNotEmpty,
  IsStrongPassword,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from 'src/auth/enums/user-role.enum';
import { AccountStatus } from 'src/auth/enums/account-status.enum';

export class CreateUserDto {
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

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false, enum: AccountStatus })
  @IsOptional()
  @IsEnum(AccountStatus, {
    message: 'Status must be unverified, verified, or banned',
  })
  status?: AccountStatus;

  @ApiProperty({ enum: UserRole, default: UserRole.CUSTOMER })
  @IsOptional()
  role?: UserRole;
}
