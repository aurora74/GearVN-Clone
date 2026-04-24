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
      uploadImage: jest
        .fn()
        .mockResolvedValue({ secure_url: 'https://cdn.test/blog.png' }),
      deleteImage: jest.fn().mockResolvedValue({ result: 'ok' }),
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
    expect(filter.isArchived).toEqual({ $ne: true });
    expect(blogModel.countDocuments).toHaveBeenCalledWith(filter);
  });

  it('shows published and draft posts in managed all visibility while excluding archived posts', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    blogModel.find.mockReturnValue({ sort, skip });
    blogModel.countDocuments.mockResolvedValue(0);

    await service.findAll({
      page: 1,
      limit: 10,
      publicOnly: false,
      visibility: 'all',
    });

    const filter = blogModel.find.mock.calls[0][0];
    expect(filter.isArchived).toEqual({ $ne: true });
    expect(filter.isPublished).toBeUndefined();
    expect(filter.$or).toBeUndefined();
    expect(blogModel.countDocuments).toHaveBeenCalledWith(filter);
  });

  it('rejects public detail access for unpublished posts', async () => {
    blogModel.findOne.mockResolvedValue({
      slug: 'draft-post',
      isPublished: false,
    });

    await expect(
      service.findBySlug('draft-post', { publicOnly: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('archives posts without deleting them', async () => {
    const blog = {
      _id: new Types.ObjectId(),
      isPublished: true,
      isArchived: false,
      archivedAt: undefined,
      unpublishedAt: undefined,
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
    };
    blogModel.findById.mockResolvedValue(blog);

    const result = await service.archive(blog._id.toString());

    expect(result.isArchived).toBe(true);
    expect(result.isPublished).toBe(false);
    expect(result.archivedAt).toBeInstanceOf(Date);
    expect(result.unpublishedAt).toBeInstanceOf(Date);
    expect(blog.save).toHaveBeenCalled();
  });
  it('throws when publishing a missing blog', async () => {
    blogModel.findById.mockResolvedValue(null);

    await expect(
      service.setPublished(new Types.ObjectId().toString(), true),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes the previous thumbnail after update persistence when replaced', async () => {
    const blog = {
      _id: new Types.ObjectId(),
      thumbnail: 'https://cdn.test/blog-old.png',
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
    };
    const cloudinaryService = {
      uploadImage: jest
        .fn()
        .mockResolvedValue({ secure_url: 'https://cdn.test/blog-new.png' }),
      deleteImage: jest.fn().mockResolvedValue({ result: 'ok' }),
    };
    blogModel.findById.mockResolvedValue(blog);
    service = new BlogService(blogModel, cloudinaryService as any);

    const result = await service.update(
      blog._id.toString(),
      { title: 'Tin moi' } as any,
      { buffer: Buffer.from('image') } as Express.Multer.File,
    );

    expect(result.thumbnail).toBe('https://cdn.test/blog-new.png');
    expect(blog.save).toHaveBeenCalled();
    expect(cloudinaryService.deleteImage).toHaveBeenCalledWith(
      'https://cdn.test/blog-old.png',
    );
  });

  it('returns a cleanup warning without rejecting when thumbnail deletion fails', async () => {
    const blog = {
      _id: new Types.ObjectId(),
      thumbnail: 'https://cdn.test/blog-old.png',
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
    };
    const cloudinaryService = {
      uploadImage: jest
        .fn()
        .mockResolvedValue({ secure_url: 'https://cdn.test/blog-new.png' }),
      deleteImage: jest.fn().mockRejectedValue(new Error('cloudinary down')),
    };
    blogModel.findById.mockResolvedValue(blog);
    service = new BlogService(blogModel, cloudinaryService as any);

    await expect(
      service.update(
        blog._id.toString(),
        { title: 'Tin moi' } as any,
        { buffer: Buffer.from('image') } as Express.Multer.File,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        cleanupWarning: true,
        cleanupFailedAssets: ['https://cdn.test/blog-old.png'],
      }),
    );
  });
});
