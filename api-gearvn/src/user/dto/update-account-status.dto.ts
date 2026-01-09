import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { AccountStatus } from '../../auth/enums/account-status.enum';
import { AccountActionDto } from './account-action.dto';

export class UpdateAccountStatusDto extends AccountActionDto {
  @ApiProperty({ enum: AccountStatus })
  @IsEnum(AccountStatus)
  status: AccountStatus;
}
