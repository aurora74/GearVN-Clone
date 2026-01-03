import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    minimum: 1,
    maximum: 5,
  })
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  rating: number;
}
