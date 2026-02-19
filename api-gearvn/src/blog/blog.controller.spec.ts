import { PATH_METADATA } from '@nestjs/common/constants';

import { Permission } from '../auth/policy/permissions';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { BlogController } from './blog.controller';

describe('BlogController publish routes', () => {
  let controller: BlogController;
  let blogService: { setPublished: jest.Mock };

  beforeEach(() => {
    blogService = { setPublished: jest.fn() };
    controller = new BlogController(blogService as any);
  });

  it('publishes and unpublishes with CONTENT_MANAGE permission metadata', async () => {
    await controller.publish('blog-1');
    await controller.unpublish('blog-1');

    expect(blogService.setPublished).toHaveBeenNthCalledWith(1, 'blog-1', true);
    expect(blogService.setPublished).toHaveBeenNthCalledWith(2, 'blog-1', false);

    const publishHandler = BlogController.prototype.publish;
    const unpublishHandler = BlogController.prototype.unpublish;

    expect(Reflect.getMetadata(PATH_METADATA, publishHandler)).toBe(':id/publish');
    expect(Reflect.getMetadata(PATH_METADATA, unpublishHandler)).toBe(':id/unpublish');
    expect(Reflect.getMetadata(PERMISSIONS_KEY, publishHandler)).toEqual([
      Permission.CONTENT_MANAGE,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, unpublishHandler)).toEqual([
      Permission.CONTENT_MANAGE,
    ]);
  });
});
