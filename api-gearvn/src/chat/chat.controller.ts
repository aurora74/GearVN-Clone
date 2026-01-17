import {
  Get,
  Body,
  Post,
  Param,
  Patch,
  Query,
  Delete,
  Request,
  UseGuards,
  Controller,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiTags,
  ApiQuery,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/policy/permissions';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtGuard } from '../auth/guards/jwt.guard';

import { ChatService } from './chat.service';
import { DeleteMessagesDto } from './dto/delete-messages.dto';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('upload')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
    return this.chatService.uploadFiles(files);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'e.g: createdAt,-sender',
  })
  @ApiQuery({ name: 'roomId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  findAll(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('roomId') roomId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.chatService.findAll({
      page,
      limit,
      search,
      sortBy,
      roomId,
      userId,
      actor: req.user,
    });
  }

  @Get('latest')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'e.g: createdAt,-sender',
  })
  @ApiQuery({ name: 'roomId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  findLatest(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('roomId') roomId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.chatService.findLatestPerUser({
      page,
      limit,
      search,
      sortBy,
      roomId,
      userId,
      actor: req.user,
    });
  }

  @Get('room/:roomId')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'e.g: createdAt,-sender',
  })
  @ApiQuery({ name: 'userId', required: false, type: String })
  getMessagesByRoom(
    @Param('roomId') roomId: string,
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('userId') userId?: string,
  ) {
    return this.chatService.getMessagesByRoomFiltered({
      roomId,
      page,
      limit,
      search,
      sortBy,
      userId,
      actor: req.user,
    });
  }

  @Patch('room/:roomId/resolve')
  @UseGuards(JwtGuard, PermissionsGuard)
  @Permissions(Permission.CSR_SUPPORT_MANAGE)
  @ApiBearerAuth()
  resolveChatTicket(@Param('roomId') roomId: string, @Request() req) {
    return this.chatService.resolveChatTicket(roomId, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  deleteMessage(@Param('id') id: string, @Request() req) {
    return this.chatService.deleteMessage(id, req.user);
  }

  @Delete()
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  deleteMessages(@Body() { userIds }: DeleteMessagesDto, @Request() req) {
    return this.chatService.deleteMessages(userIds, req.user);
  }
}
