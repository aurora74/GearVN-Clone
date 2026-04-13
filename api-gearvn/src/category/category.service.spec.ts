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
  const categoryModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };
  const productModel = {
    exists: jest.fn(),
  };

  return {
    categoryModel,
    productModel,
    service: new CategoryService(
      categoryModel as any,
      productModel as any,
      { uploadImage: jest.fn() } as any,
    ),
  };
};

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

  it('blocks field removal when a product still has the attribute key', async () => {
    const { service, categoryModel, productModel } = createService();
    categoryModel.findById.mockResolvedValue(makeCategory());
    productModel.exists.mockResolvedValueOnce({ _id: 'product-id' });

    await expect(
      service.update('category-id', {
        fields: [{ name: 'brand', label: 'Brand', type: 'text' }],
      } as any),
    ).rejects.toThrow('CATEGORY_FIELD_HAS_DEPENDENT_PRODUCTS');

    expect(productModel.exists).toHaveBeenCalledWith({
      category: 'laptop',
      isArchived: { $ne: true },
      'attributes.ram': { $exists: true },
    });
  });

  it('blocks category renames when active products reference the category', async () => {
    const { service, categoryModel, productModel } = createService();
    categoryModel.findById.mockResolvedValue(makeCategory());
    productModel.exists.mockResolvedValue({ _id: 'product-id' });

    await expect(
      service.update('category-id', { name: 'Gaming Laptop' } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
