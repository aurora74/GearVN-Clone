import {
  Get,
  Body,
  Post,
  Param,
  Query,
  Delete,
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

import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

import { ChatService } from './chat.service';
import { UserRole } from 'src/auth/enums/user-role.enum';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { DeleteMessagesDto } from './dto/delete-messages.dto';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('upload')
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
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
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
    });
  }

  @Get('latest')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
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
    });
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  deleteMessage(@Param('id') id: string) {
    return this.chatService.deleteMessage(id);
  }

  @Delete()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  deleteMessages(@Body() { userIds }: DeleteMessagesDto) {
    return this.chatService.deleteMessages(userIds);
  }
}
