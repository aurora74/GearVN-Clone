import {
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
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
import { memoryStorage } from 'multer';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { Permission } from 'src/auth/policy/permissions';

@ApiTags('Events')
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @ApiBearerAuth()
  @Permissions(Permission.CONTENT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiBody({ type: CreateEventDto })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'frame', maxCount: 1 },
        { name: 'image', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  create(
    @Body() body: CreateEventDto,
    @UploadedFiles()
    files: {
      frame?: Express.Multer.File[];
      image?: Express.Multer.File[];
    },
  ) {
    return this.eventService.create(body, files);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Permissions(Permission.CONTENT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiBody({ type: CreateEventDto })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'frame', maxCount: 1 },
        { name: 'image', maxCount: 1 },
      ],
      { storage: memoryStorage() },
    ),
  )
  update(
    @Param('id') id: string,
    @Body() body: Partial<CreateEventDto>,
    @UploadedFiles()
    files: {
      frame?: Express.Multer.File[];
      image?: Express.Multer.File[];
    },
  ) {
    return this.eventService.update(id, body, files);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'e.g: name,-createdAt',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    type: String,
    description: 'e.g: name,tag,frame',
  })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('fields') fields?: string,
  ) {
    return this.eventService.findAll({
      page,
      limit,
      search,
      sortBy,
      fields,
    });
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Permissions(Permission.CONTENT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  remove(@Param('id') id: string) {
    return this.eventService.remove(id);
  }
}
