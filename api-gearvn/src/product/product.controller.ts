import {
  Get,
  Put,
  Post,
  Body,
  Query,
  Param,
  Delete,
  Request,
  UseGuards,
  Controller,
  UploadedFiles,
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
import { memoryStorage } from 'multer';
import { FilesInterceptor } from '@nestjs/platform-express';

import { ProductService } from './product.service';
import { UserRole } from 'src/auth/enums/user-role.enum';
import { Roles } from 'src/auth/decorators/roles.decorator';

import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(private productService: ProductService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 10, { storage: memoryStorage() }))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        slug: { type: 'string' },
        category: { type: 'string' },
        price: { type: 'number' },
        discountPrice: { type: 'number' },
        discountPercent: { type: 'number' },
        description: { type: 'string' },
        attributes: { type: 'string' },
        stock: { type: 'number', minimum: 0 },
        events: { type: 'string' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          minItems: 1,
        },
      },
      required: [
        'name',
        'slug',
        'category',
        'price',
        'attributes',
        'images',
        'stock',
      ],
    },
  })
  create(@Body() body: any, @UploadedFiles() files: Express.Multer.File[]) {
    return this.productService.create(body, files);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', required: true })
  @UseInterceptors(FilesInterceptor('images', 10, { storage: memoryStorage() }))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        slug: { type: 'string' },
        category: { type: 'string' },
        price: { type: 'number' },
        discountPrice: { type: 'number' },
        discountPercent: { type: 'number' },
        description: { type: 'string' },
        attributes: { type: 'string' },
        oldImages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keep existing image URLs',
        },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        stock: { type: 'number', description: 'Quantity in stock' },
      },
    },
  })
  update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productService.update(id, body, files);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'fields', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'event', required: false, type: String })
  @ApiQuery({
    name: 'attributes',
    required: false,
    type: String,
    description: `Dynamic attribute filters as key=value1,value2
    Example: ?attributes=brand=Razer,ASUS;size=24,15`,
  })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('event') event?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('fields') fields?: string,
    @Query('category') category?: string,
    @Query('attributes') attributesRaw?: string,
  ) {
    return this.productService.findAll({
      page: Number(page),
      limit: Number(limit),
      search,
      sortBy,
      fields,
      category,
      event,
      attributesRaw,
    });
  }

  @Get('related/:id')
  @ApiParam({ name: 'id', required: true })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'fields', required: false, type: String })
  findRelated(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('fields') fields?: string,
  ) {
    return this.productService.findRelated(id, {
      page: Number(page),
      limit: Number(limit),
      search,
      sortBy,
      fields,
    });
  }

  @Get('slug/:slug')
  @ApiParam({ name: 'slug', required: true })
  findBySlug(@Param('slug') slug: string) {
    return this.productService.findBySlug(slug);
  }

  @Get(':id')
  @ApiParam({ name: 'id', required: true })
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtGuard, RolesGuard)
  @ApiParam({ name: 'id', required: true })
  delete(@Param('id') id: string) {
    return this.productService.delete(id);
  }

  @Post('comment/:id')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 10, { storage: memoryStorage() }))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        rating: { type: 'number' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          minItems: 0,
        },
      },
      required: ['content', 'rating'],
    },
  })
  async comment(
    @Param('id') productId: string,
    @Body() dto: CreateCommentDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.productService.comment(productId, userId, dto, files);
  }

  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @Post('comment/:productId/:commentId/like')
  async toggleLikeComment(
    @Param('productId') productId: string,
    @Param('commentId') commentId: string,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.productService.toggleLikeComment(productId, commentId, userId);
  }

  @Post('comment/:productId/:commentId/reply')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 10, { storage: memoryStorage() }))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          minItems: 0,
        },
      },
      required: ['content'],
    },
  })
  async replyComment(
    @Param('productId') productId: string,
    @Param('commentId') parentCommentId: string,
    @Body() body: { content: string },
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.productService.replyComment(
      productId,
      parentCommentId,
      userId,
      body.content,
      files,
    );
  }

  @Put('comment/:productId/:commentId')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 10, { storage: memoryStorage() }))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          minItems: 0,
        },
        oldImages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Danh sách URL ảnh giữ lại',
        },
      },
      required: ['content'],
    },
  })
  async editComment(
    @Param('productId') productId: string,
    @Param('commentId') commentId: string,
    @Body() body: { content: string; oldImages?: string[] },
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.productService.editComment(
      productId,
      commentId,
      userId,
      body.content,
      files,
      body.oldImages || [],
    );
  }

  @Delete('comment/:productId/:commentId')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiParam({ name: 'productId', type: String })
  @ApiParam({ name: 'commentId', type: String })
  async deleteComment(
    @Param('productId') productId: string,
    @Param('commentId') commentId: string,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.productService.deleteComment(productId, commentId, userId);
  }
}
