import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Blog, BlogSchema } from '../blog/blog.schema';
import { BlogComment, BlogCommentSchema } from './blog-comment.schema';
import { ModerationModule } from '../moderation/moderation.module';
import { BlogCommentController } from './blog-comment.controller';
import { BlogCommentService } from './blog-comment.service';

@Module({
  imports: [
    ModerationModule,
    MongooseModule.forFeature([
      { name: BlogComment.name, schema: BlogCommentSchema },
      { name: Blog.name, schema: BlogSchema },
    ]),
  ],
  controllers: [BlogCommentController],
  providers: [BlogCommentService],
  exports: [BlogCommentService],
})
export class BlogCommentModule {}
