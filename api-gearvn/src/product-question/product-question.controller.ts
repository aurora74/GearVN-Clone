import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permission } from '../auth/policy/permissions';
import {
  AddProductQuestionCommentDto,
  CreateProductQuestionDto,
} from './dto/product-question.dto';
import { ProductQuestionService } from './product-question.service';

@ApiTags('Product Questions')
@Controller('product-questions')
export class ProductQuestionController {
  constructor(private readonly productQuestionService: ProductQuestionService) {}

  @Get('product/:productId')
  @ApiParam({ name: 'productId', required: true })
  listByProduct(@Param('productId') productId: string) {
    return this.productQuestionService.listByProduct(productId);
  }

  @Post('product/:productId')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 3, { storage: memoryStorage() }))
  @ApiBody({
    schema: {
      type: 'object',
      required: ['content'],
      properties: {
        content: { type: 'string' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  createQuestion(
    @Param('productId') productId: string,
    @Request() req,
    @Body() dto: CreateProductQuestionDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productQuestionService.createQuestion(
      productId,
      req.user,
      dto,
      files,
    );
  }

  @Post(':questionId/comments')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 3, { storage: memoryStorage() }))
  addComment(
    @Param('questionId') questionId: string,
    @Request() req,
    @Body() dto: AddProductQuestionCommentDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productQuestionService.addComment(questionId, req.user, dto, files);
  }

  @Post(':questionId/answers')
  @ApiBearerAuth()
  @Permissions(Permission.CSR_SUPPORT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 3, { storage: memoryStorage() }))
  answerQuestion(
    @Param('questionId') questionId: string,
    @Request() req,
    @Body() dto: AddProductQuestionCommentDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productQuestionService.answerQuestion(
      questionId,
      req.user,
      dto,
      files,
    );
  }

  @Post(':questionId/moderate')
  @ApiBearerAuth()
  @Permissions(Permission.CSR_SUPPORT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  moderateQuestion(
    @Param('questionId') questionId: string,
    @Request() req,
    @Body() body: { action: 'hide' | 'delete'; reason: string },
  ) {
    return this.productQuestionService.moderateQuestion(questionId, req.user, body);
  }

  @Post(':questionId/comments/:commentId/moderate')
  @ApiBearerAuth()
  @Permissions(Permission.CSR_SUPPORT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  moderateQuestionComment(
    @Param('questionId') questionId: string,
    @Param('commentId') commentId: string,
    @Request() req,
    @Body() body: { action: 'hide' | 'delete'; reason: string },
  ) {
    return this.productQuestionService.moderateQuestionComment(
      questionId,
      commentId,
      req.user,
      body,
    );
  }
}
