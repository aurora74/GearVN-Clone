import {
  IsEmail,
  Matches,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  IsStrongPassword,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(50, { message: 'Full name must be at most 50 characters' })
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
  @IsOptional()
  @Matches(/^(0|\+84)(3[2-9]|5[6|8|9]|7[0|6-9]|8[1-5]|9[0-9])[0-9]{7}$/, {
    message: 'Invalid Vietnamese phone number',
  })
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Address must be at most 200 characters' })
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)$/i, {
    message: 'Avatar URL must be a valid image URL',
  })
  avatarUrl?: string;
}
