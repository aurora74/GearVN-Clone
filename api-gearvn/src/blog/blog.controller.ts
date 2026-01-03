import {
  Get,
  Body,
  Post,
  Put,
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

import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

import { BlogService } from './blog.service';
import { UserRole } from 'src/auth/enums/user-role.enum';
import { Roles } from 'src/auth/decorators/roles.decorator';

@ApiTags('Blogs')
@Controller('blogs')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
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

  @Get(':id')
  @ApiParam({ name: 'id', required: true })
  async findOne(@Param('id') id: string) {
    return this.blogService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiParam({ name: 'slug', required: true })
  async findBySlug(@Param('slug') slug: string) {
    return this.blogService.findBySlug(slug);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
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
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
  @ApiParam({ name: 'id', required: true })
  async remove(@Param('id') id: string) {
    return this.blogService.remove(id);
  }
}
