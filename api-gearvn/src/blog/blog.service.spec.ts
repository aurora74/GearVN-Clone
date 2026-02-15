import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { BlogService } from './blog.service';

const createBlogModel = () => {
  const model: any = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: new Types.ObjectId(),
    save: jest.fn().mockResolvedValue(undefined),
  }));

  model.find = jest.fn();
  model.findById = jest.fn();
  model.findOne = jest.fn();
  model.findByIdAndUpdate = jest.fn();
  model.countDocuments = jest.fn();

  return model;
};

describe('BlogService', () => {
  let blogModel: any;
  let service: BlogService;

  beforeEach(() => {
    blogModel = createBlogModel();
    service = new BlogService(blogModel, {
      uploadImage: jest.fn().mockResolvedValue({ secure_url: 'https://cdn.test/blog.png' }),
    } as any);
  });

  it('creates new posts unpublished by default', async () => {
    await service.create(
      {
        title: 'Tin moi',
        slug: 'tin-moi',
        summary: 'Tom tat',
        description: 'Noi dung',
      },
      { buffer: Buffer.from('image') } as Express.Multer.File,
    );

    expect(blogModel).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Tin moi',
        isPublished: false,
        publishedAt: undefined,
        unpublishedAt: undefined,
      }),
    );
  });

  it('publishes and unpublishes directly through setPublished', async () => {
    const blog = {
      _id: new Types.ObjectId(),
      isPublished: false,
      publishedAt: undefined,
      unpublishedAt: undefined,
      save: jest.fn().mockResolvedValue(undefined),
    };
    blogModel.findById.mockResolvedValue(blog);

    const published = await service.setPublished(blog._id.toString(), true);
    expect(published.isPublished).toBe(true);
    expect(published.publishedAt).toBeInstanceOf(Date);
    expect(published.unpublishedAt).toBeUndefined();

    const unpublished = await service.setPublished(blog._id.toString(), false);
    expect(unpublished.isPublished).toBe(false);
    expect(unpublished.unpublishedAt).toBeInstanceOf(Date);
    expect(blog.save).toHaveBeenCalledTimes(2);
  });

  it('filters public lists to published or legacy posts only', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    blogModel.find.mockReturnValue({ sort, skip });
    blogModel.countDocuments.mockResolvedValue(0);

    await service.findAll({ page: 1, limit: 10, publicOnly: true });

    const filter = blogModel.find.mock.calls[0][0];
    expect(filter.$or).toEqual([
      { isPublished: true },
      { isPublished: { $exists: false } },
    ]);
    expect(blogModel.countDocuments).toHaveBeenCalledWith(filter);
  });

  it('rejects public detail access for unpublished posts', async () => {
    blogModel.findOne.mockResolvedValue({ slug: 'draft-post', isPublished: false });

    await expect(service.findBySlug('draft-post', { publicOnly: true })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws when publishing a missing blog', async () => {
    blogModel.findById.mockResolvedValue(null);

    await expect(service.setPublished(new Types.ObjectId().toString(), true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
