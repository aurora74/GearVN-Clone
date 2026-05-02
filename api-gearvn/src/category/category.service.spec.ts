import { BadRequestException } from '@nestjs/common';

import { CategoryService } from './category.service';

const makeCategory = (overrides: Record<string, unknown> = {}) => ({
  _id: 'category-id',
  name: 'laptop',
  label: 'Laptop',
  fields: [
    { name: 'brand', label: 'Brand', type: 'text' },
    { name: 'ram', label: 'RAM', type: 'number' },
  ],
  isPublished: true,
  isArchived: false,
  save: jest.fn().mockImplementation(function (this: any) {
    return Promise.resolve(this);
  }),
  ...overrides,
});

const createService = () => {
  const categoryQuery = {
    sort: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  const categoryModel = {
    find: jest.fn().mockReturnValue(categoryQuery),
    findOne: jest.fn(),
    countDocuments: jest.fn().mockResolvedValue(0),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };
  const productModel = {
    exists: jest.fn(),
  };

  const cloudinaryService = {
    uploadImage: jest.fn().mockResolvedValue({ secure_url: 'https://cdn.test/category-new.png' }),
    deleteImage: jest.fn().mockResolvedValue({ result: 'ok' }),
  };

  return {
    categoryModel,
    categoryQuery,
    productModel,
    cloudinaryService,
    service: new CategoryService(
      categoryModel as any,
      productModel as any,
      cloudinaryService as any,
    ),
  };
};

describe('CategoryService public list ordering', () => {
  it('defaults public category lists to newest createdAt order', async () => {
    const { service, categoryModel, categoryQuery } = createService();

    await service.findAll({ page: 1, limit: 20 });

    expect(categoryModel.find).toHaveBeenCalledWith({
      isPublished: { $ne: false },
      isArchived: { $ne: true },
    });
    expect(categoryQuery.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(categoryQuery.skip).toHaveBeenCalledWith(0);
    expect(categoryQuery.limit).toHaveBeenCalledWith(20);
    expect(categoryModel.countDocuments).toHaveBeenCalledWith({
      isPublished: { $ne: false },
      isArchived: { $ne: true },
    });
  });

  it('keeps public category filters when sorting newest first', async () => {
    const { service, categoryModel, categoryQuery } = createService();

    await service.findAll({ page: 2, limit: 10, sortBy: '-createdAt,label,unsafe' });

    expect(categoryModel.find).toHaveBeenCalledWith({
      isPublished: { $ne: false },
      isArchived: { $ne: true },
    });
    expect(categoryQuery.sort).toHaveBeenCalledWith({ createdAt: -1, label: 1 });
    expect(categoryQuery.skip).toHaveBeenCalledWith(10);
    expect(categoryQuery.limit).toHaveBeenCalledWith(10);
    expect(categoryModel.countDocuments).toHaveBeenCalledWith({
      isPublished: { $ne: false },
      isArchived: { $ne: true },
    });
  });
});

describe('CategoryService public metadata visibility', () => {
  it('requires visible categories before returning field metadata', async () => {
    const { service, categoryModel } = createService();
    const select = jest.fn().mockResolvedValue(makeCategory());
    categoryModel.findOne.mockReturnValue({ select });

    await expect(service.findCategoryByName('laptop')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'brand' })]),
    );

    expect(categoryModel.findOne).toHaveBeenCalledWith({
      name: 'laptop',
      isPublished: { $ne: false },
      isArchived: { $ne: true },
    });
    expect(select).toHaveBeenCalledWith('fields');
  });

  it('requires visible categories before returning labels', async () => {
    const { service, categoryModel } = createService();
    categoryModel.findOne.mockResolvedValue(makeCategory({ label: 'Laptop Gaming' }));

    await expect(service.findLabelByCategory('laptop')).resolves.toEqual({
      label: 'Laptop Gaming',
    });

    expect(categoryModel.findOne).toHaveBeenCalledWith({
      name: 'laptop',
      isPublished: { $ne: false },
      isArchived: { $ne: true },
    });
  });
});
describe('CategoryService lifecycle dependency guards', () => {
  it('blocks archive when active products depend on the category', async () => {
    const { service, categoryModel, productModel } = createService();
    categoryModel.findById.mockResolvedValue(makeCategory());
    productModel.exists.mockResolvedValue({ _id: 'product-id' });

    await expect(service.archive('category-id')).rejects.toThrow(
      'CATEGORY_HAS_DEPENDENT_PRODUCTS',
    );

    expect(productModel.exists).toHaveBeenCalledWith({
      category: 'laptop',
      isArchived: { $ne: true },
    });
  });

  it('archives when no active products depend on the category', async () => {
    const { service, categoryModel, productModel } = createService();
    const category = makeCategory();
    categoryModel.findById.mockResolvedValue(category);
    productModel.exists.mockResolvedValue(null);

    const result = await service.archive('category-id');

    expect(result.isArchived).toBe(true);
    expect(result.isPublished).toBe(false);
    expect(result.archivedAt).toBeInstanceOf(Date);
    expect(category.save).toHaveBeenCalled();
  });

  it('does not upload replacement image when field dependency guard rejects', async () => {
    const { service, categoryModel, productModel, cloudinaryService } = createService();
    categoryModel.findById.mockResolvedValue(makeCategory());
    productModel.exists.mockResolvedValueOnce({ _id: 'product-id' });

    await expect(
      service.update(
        'category-id',
        {
          fields: [{ name: 'brand', label: 'Brand', type: 'text' }],
        } as any,
        { buffer: Buffer.from('image') } as Express.Multer.File,
      ),
    ).rejects.toThrow('CATEGORY_FIELD_HAS_DEPENDENT_PRODUCTS');

    expect(productModel.exists).toHaveBeenCalledWith({
      category: 'laptop',
      isArchived: { $ne: true },
      'attributes.ram': { $exists: true },
    });
    expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
    expect(categoryModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('does not upload replacement image when rename dependency guard rejects', async () => {
    const { service, categoryModel, productModel, cloudinaryService } = createService();
    categoryModel.findById.mockResolvedValue(makeCategory());
    productModel.exists.mockResolvedValue({ _id: 'product-id' });

    await expect(
      service.update(
        'category-id',
        { name: 'Gaming Laptop' } as any,
        { buffer: Buffer.from('image') } as Express.Multer.File,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
    expect(categoryModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('deletes the previous image after update persistence when a category image is replaced', async () => {
    const { service, categoryModel, productModel, cloudinaryService } = createService();
    const category = makeCategory({ image: 'https://cdn.test/category-old.png' });
    const updatedCategory = { ...category, image: 'https://cdn.test/category-new.png' };
    categoryModel.findById.mockResolvedValue(category);
    categoryModel.findByIdAndUpdate.mockResolvedValue(updatedCategory);
    productModel.exists.mockResolvedValue(null);

    await expect(
      service.update('category-id', { label: 'Laptop gaming' } as any, {
        buffer: Buffer.from('image'),
      } as Express.Multer.File),
    ).resolves.toEqual(updatedCategory);

    expect(categoryModel.findByIdAndUpdate).toHaveBeenCalled();
    expect(cloudinaryService.deleteImage).toHaveBeenCalledWith('https://cdn.test/category-old.png');
  });

  it('returns a cleanup warning without rejecting when category image deletion fails', async () => {
    const { service, categoryModel, productModel, cloudinaryService } = createService();
    const category = makeCategory({ image: 'https://cdn.test/category-old.png' });
    const updatedCategory = { ...category, image: 'https://cdn.test/category-new.png' };
    categoryModel.findById.mockResolvedValue(category);
    categoryModel.findByIdAndUpdate.mockResolvedValue(updatedCategory);
    productModel.exists.mockResolvedValue(null);
    cloudinaryService.deleteImage.mockRejectedValue(new Error('cloudinary down'));

    await expect(
      service.update('category-id', { label: 'Laptop gaming' } as any, {
        buffer: Buffer.from('image'),
      } as Express.Multer.File),
    ).resolves.toEqual(
      expect.objectContaining({
        cleanupWarning: true,
        cleanupFailedAssets: ['https://cdn.test/category-old.png'],
      }),
    );
  });
});
