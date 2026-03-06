import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import { SUPPORT_TICKET_STATUS } from '../../config.global';
import { SupportTicketStatus } from '../support-ticket.schema';

export class UpdateSupportTicketStatusDto {
  @ApiProperty({ enum: Object.values(SUPPORT_TICKET_STATUS) })
  @IsIn(Object.values(SUPPORT_TICKET_STATUS))
  status: SupportTicketStatus;
}
