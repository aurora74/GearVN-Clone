import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateBlogDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  title: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  summary: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  description: string;
}
