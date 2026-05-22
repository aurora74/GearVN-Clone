import { CategorySchema } from '../category/category.schema';
import { ProductSchema } from './product.schema';

const readDefaultValue = (path: unknown) => {
  const defaultValue = (path as { defaultValue?: unknown } | undefined)
    ?.defaultValue;
  return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
};

describe('product search metadata schema', () => {
  it('stores flexible search metadata on products', () => {
    const path = ProductSchema.path('searchMetadata');

    expect(path).toBeDefined();
    expect(path?.instance).toBe('Mixed');
    expect(readDefaultValue(path)).toEqual({});
  });

  it('defines targeted search metadata indexes without wildcard metadata indexes', () => {
    const indexes = ProductSchema.indexes().map(([fields]) => fields);

    expect(indexes).toContainEqual({ 'searchMetadata.sourceSku': 1 });
    expect(indexes).toContainEqual({ 'searchMetadata.sourceUrlKey': 1 });
    expect(indexes).toContainEqual({ 'searchMetadata.normalizedName': 1 });
    expect(indexes).toContainEqual({ createdAt: -1, _id: -1 });
    expect(indexes).toContainEqual({
      isArchived: 1,
      isPublished: 1,
      createdAt: -1,
      _id: -1,
    });
    expect(indexes).toContainEqual({
      isArchived: 1,
      isPublished: 1,
      category: 1,
      createdAt: -1,
      _id: -1,
    });
    expect(indexes).toContainEqual({
      isArchived: 1,
      isPublished: 1,
      category: 1,
      'searchMetadata.categoryPath': 1,
    });
    expect(indexes).toContainEqual({
      name: 'text',
      description: 'text',
      'searchMetadata.searchText': 'text',
    });
    expect(indexes).not.toContainEqual({ 'searchMetadata.$**': 1 });
  });

  it('stores flexible category source metadata for crawl sync', () => {
    const path = CategorySchema.path('sourceMetadata');

    expect(path).toBeDefined();
    expect(path?.instance).toBe('Mixed');
    expect(readDefaultValue(path)).toEqual({});
  });
});
