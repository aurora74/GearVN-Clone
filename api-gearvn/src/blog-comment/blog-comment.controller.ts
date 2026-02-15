import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permission } from '../auth/policy/permissions';
import { BlogCommentService } from './blog-comment.service';
import { CreateBlogCommentDto } from './dto/blog-comment.dto';

@ApiTags('Blog Comments')
@Controller('blogs/:blogId/comments')
export class BlogCommentController {
  constructor(private readonly blogCommentService: BlogCommentService) {}

  @Get()
  @ApiParam({ name: 'blogId', required: true })
  list(@Param('blogId') blogId: string) {
    return this.blogCommentService.listByBlog(blogId);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiParam({ name: 'blogId', required: true })
  create(
    @Param('blogId') blogId: string,
    @Request() req: any,
    @Body() dto: CreateBlogCommentDto,
  ) {
    return this.blogCommentService.createComment(blogId, req.user, dto);
  }

  @Post(':commentId/moderate')
  @ApiBearerAuth()
  @Permissions(Permission.CSR_SUPPORT_MANAGE)
  @UseGuards(JwtGuard, PermissionsGuard)
  moderate(
    @Param('commentId') commentId: string,
    @Request() req: any,
    @Body() body: { action: 'hide' | 'delete'; reason: string },
  ) {
    return this.blogCommentService.moderateBlogComment(commentId, req.user, body);
  }
}
