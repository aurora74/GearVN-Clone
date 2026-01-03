import {
  Get,
  Put,
  Body,
  Post,
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
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

import { CategoryService } from './category.service';
import { UserRole } from 'src/auth/enums/user-role.enum';
import { Roles } from 'src/auth/decorators/roles.decorator';

@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        label: { type: 'string' },
        fields: { type: 'array', items: { type: 'object' } },
        image: { type: 'string', format: 'binary' },
      },
      required: ['name', 'label', 'fields'],
    },
  })
  create(@Body() dto: any, @UploadedFile() file: Express.Multer.File) {
    return this.categoryService.create(dto, file);
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
    description: 'e.g: name,label,fields',
  })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('fields') fields?: string,
  ) {
    return this.categoryService.findAll({
      page,
      limit,
      search,
      sortBy,
      fields,
    });
  }

  @Get('fields/:category')
  @ApiParam({ name: 'category', type: String })
  async findCategoryByName(@Param('category') category: string) {
    return this.categoryService.findCategoryByName(category);
  }

  @Get('label/:category')
  @ApiParam({ name: 'category', type: String })
  async findLabelByCategory(@Param('category') category: string) {
    return this.categoryService.findLabelByCategory(category);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', type: String })
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        label: { type: 'string' },
        fields: { type: 'string' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.categoryService.update(id, dto, file);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}
