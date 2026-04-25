import {
  Get,
  Body,
  Post,
  Put,
  Patch,
  Param,
  Query,
  Delete,
  UseGuards,
  Controller,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBody,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permission } from '../auth/policy/permissions';

import { BlogService } from './blog.service';

@ApiTags('Blogs')
@Controller('blogs')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @ApiBearerAuth()
  @Permissions(Permission.CONTENT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('thumbnail'))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        slug: { type: 'string' },
        summary: { type: 'string' },
        description: { type: 'string' },
        thumbnail: { type: 'string', format: 'binary' },
      },
      required: ['title', 'slug', 'summary', 'description', 'thumbnail'],
    },
  })
  async create(
    @Body() body: CreateBlogDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.blogService.create(body, file);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Sort fields. Example: title,-createdAt',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    type: String,
    description: 'Select fields. Example: title,summary,slug',
  })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('fields') fields?: string,
  ) {
    return this.blogService.findAll({
      page,
      limit,
      search,
      sortBy,
      fields,
      publicOnly: true,
    });
  }

  @Get('manage')
  @ApiBearerAuth()
  @Permissions(Permission.CONTENT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'fields', required: false, type: String })
  @ApiQuery({ name: 'visibility', required: false, type: String })
  async findAllForManage(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('fields') fields?: string,
    @Query('visibility') visibility?: 'all' | 'active' | 'unpublished' | 'archived',
  ) {
    return this.blogService.findAll({
      page,
      limit,
      search,
      sortBy,
      fields,
      publicOnly: false,
      visibility: visibility ?? 'active',
    });
  }

  @Get('related/:id')
  @ApiParam({ name: 'id', required: true })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Sort fields. Example: title,-createdAt',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    type: String,
    description: 'Select fields. Example: title,summary,slug',
  })
  async findRelated(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 6,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('fields') fields?: string,
  ) {
    return this.blogService.findRelated(id, {
      page,
      limit,
      search,
      sortBy,
      fields,
    });
  }

  @Get('slug/:slug')
  @ApiParam({ name: 'slug', required: true })
  async findBySlug(@Param('slug') slug: string) {
    return this.blogService.findBySlug(slug);
  }

  @Get(':id')
  @ApiBearerAuth()
  @Permissions(Permission.CONTENT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiParam({ name: 'id', required: true })
  async findOne(@Param('id') id: string) {
    return this.blogService.findOne(id);
  }

  @Patch(':id/publish')
  @ApiBearerAuth()
  @Permissions(Permission.CONTENT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiParam({ name: 'id', required: true })
  async publish(@Param('id') id: string) {
    return this.blogService.setPublished(id, true);
  }

  @Patch(':id/unpublish')
  @ApiBearerAuth()
  @Permissions(Permission.CONTENT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiParam({ name: 'id', required: true })
  async unpublish(@Param('id') id: string) {
    return this.blogService.setPublished(id, false);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Permissions(Permission.CONTENT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('thumbnail'))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        slug: { type: 'string' },
        summary: { type: 'string' },
        description: { type: 'string' },
        thumbnail: { type: 'string', format: 'binary' },
      },
      required: ['title', 'slug', 'summary', 'description'],
    },
  })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateBlogDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.blogService.update(id, body, file);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Permissions(Permission.CONTENT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiParam({ name: 'id', required: true })
  async remove(@Param('id') id: string) {
    return this.blogService.remove(id);
  }
}
