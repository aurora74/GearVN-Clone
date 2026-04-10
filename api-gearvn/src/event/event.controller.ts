import {
  Get,
  Req,
  Post,
  Put,
  Body,
  Query,
  Param,
  Patch,
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
import { Request } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { Permission } from 'src/auth/policy/permissions';
import { OwnershipActor } from 'src/auth/policy/ownership';

@ApiTags('Events')
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @ApiBearerAuth()
  @Permissions(Permission.PROMOTION_MANAGE)
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
    @Req() req: Request & { user: OwnershipActor },
  ) {
    return this.eventService.create(
      body,
      files,
      req.user,
      this.getRequestContext(req),
    );
  }

  @Put(':id')
  @ApiBearerAuth()
  @Permissions(Permission.PROMOTION_MANAGE)
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
    @Req() req: Request & { user: OwnershipActor },
  ) {
    return this.eventService.update(
      id,
      body,
      files,
      req.user,
      this.getRequestContext(req),
    );
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
  @Permissions(Permission.PROMOTION_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  remove(
    @Param('id') id: string,
    @Body() body: Partial<CreateEventDto>,
    @Req() req: Request & { user: OwnershipActor },
  ) {
    return this.eventService.remove(
      id,
      req.user,
      this.getRequestContext(req),
      body.reason,
    );
  }

  @Patch(':id/enable')
  @ApiBearerAuth()
  @Permissions(Permission.PROMOTION_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  enable(
    @Param('id') id: string,
    @Body() body: Partial<CreateEventDto>,
    @Req() req: Request & { user: OwnershipActor },
  ) {
    return this.eventService.setEnabled(
      id,
      true,
      req.user,
      this.getRequestContext(req),
      body.reason,
    );
  }

  @Patch(':id/disable')
  @ApiBearerAuth()
  @Permissions(Permission.PROMOTION_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  disable(
    @Param('id') id: string,
    @Body() body: Partial<CreateEventDto>,
    @Req() req: Request & { user: OwnershipActor },
  ) {
    return this.eventService.setEnabled(
      id,
      false,
      req.user,
      this.getRequestContext(req),
      body.reason,
    );
  }

  @Patch(':id/end')
  @ApiBearerAuth()
  @Permissions(Permission.PROMOTION_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  end(
    @Param('id') id: string,
    @Body() body: Partial<CreateEventDto>,
    @Req() req: Request & { user: OwnershipActor },
  ) {
    return this.eventService.endNow(
      id,
      req.user,
      this.getRequestContext(req),
      body.reason,
    );
  }

  private getRequestContext(req: Request) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];

    return {
      ip:
        (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
          ?.split(',')[0]
          ?.trim() ||
        req.ip ||
        req.socket?.remoteAddress,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }
}
