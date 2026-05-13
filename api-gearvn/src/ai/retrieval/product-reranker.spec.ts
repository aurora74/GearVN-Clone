import { ProductCandidate } from './product-retrieval.types';
import { rerankProducts } from './product-reranker';

describe('product reranker microphone matching', () => {
  const candidate = (
    productId: string,
    name: string,
    categoryPath: string[],
    semanticTags: string[] = [],
  ): ProductCandidate => ({
    productId,
    score: 0.7,
    payload: {
      productId,
      name,
      slug: productId,
      category: categoryPath.at(-1) ?? '',
      categoryPath,
      price: 500_000,
      discountPrice: 450_000,
      stock: 5,
      isPublished: true,
      isArchived: false,
      semanticTags,
      useCases: [],
      targetUsers: [],
    },
  });

  it('does not treat Micro USB cable taxonomy as a microphone category match', () => {
    const cable = candidate('cable', 'Cáp NATIT Micro USB', [
      'Phụ kiện',
      'Sạc - Cáp',
      'Cáp',
      'Micro',
      'Pin dự phòng',
    ]);
    const audioMic = candidate(
      'mic',
      'Micro thu âm livestream USB',
      ['Phụ kiện', 'Thiết bị âm thanh', 'Micro thu âm'],
      ['recording'],
    );

    const result = rerankProducts(
      'ưu tiên micro tốt hơn cho livestream',
      [cable, audioMic],
      {
        constraints: { categoryHints: ['microphone', 'micro', 'micro thu am'] },
      },
    );

    expect(result.map((item) => item.productId)).toEqual(['mic']);
    expect(result[0].reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'category_match' }),
      ]),
    );
  });

  it('does not treat laptop built-in microphone metadata as a standalone microphone', () => {
    const laptop = candidate(
      'laptop-built-in-mic',
      'Laptop creator with conferencing audio',
      ['Laptop', 'Creator laptop'],
      ['built-in 3-microphone array', 'headphone microphone combo'],
    );
    const audioMic = candidate(
      'standalone-mic',
      'Micro thu âm USB cho livestream',
      ['Phụ kiện', 'Thiết bị âm thanh', 'Micro thu âm'],
      ['recording'],
    );

    const result = rerankProducts(
      'cần micro rời để livestream',
      [laptop, audioMic],
      {
        constraints: { categoryHints: ['microphone', 'micro', 'micro thu am'] },
      },
    );

    expect(result.map((item) => item.productId)).toEqual(['standalone-mic']);
  });
});

describe('product reranker headset matching', () => {
  const candidate = (
    productId: string,
    name: string,
    categoryPath: string[],
  ): ProductCandidate => ({
    productId,
    score: 0.7,
    payload: {
      productId,
      name,
      slug: productId,
      category: categoryPath.at(-1) ?? '',
      categoryPath,
      price: 500_000,
      discountPrice: 450_000,
      stock: 5,
      isPublished: true,
      isArchived: false,
      semanticTags: [],
      useCases: [],
      targetUsers: [],
    },
  });

  it('does not treat keyboard identity as a headset because of polluted category path', () => {
    const keyboard = candidate('keyboard', 'Bàn phím cơ wireless', [
      'Phụ kiện',
      'Tai nghe',
      'Bàn phím',
    ]);
    const headset = candidate('headset', 'Tai nghe gaming có mic', [
      'Phụ kiện',
      'Tai nghe gaming',
    ]);

    const result = rerankProducts(
      'cần tai nghe livestream',
      [keyboard, headset],
      {
        constraints: { categoryHints: ['headset', 'tai nghe'] },
      },
    );

    expect(result.map((item) => item.productId)).toEqual(['headset']);
  });
});
describe('product reranker desktop PC matching', () => {
  const candidate = (
    productId: string,
    name: string,
    categoryPath: string[],
  ): ProductCandidate => ({
    productId,
    score: 0.7,
    payload: {
      productId,
      name,
      slug: productId,
      category: categoryPath.at(-1) ?? '',
      categoryPath,
      price: 1_000_000,
      discountPrice: 900_000,
      stock: 5,
      isPublished: true,
      isArchived: false,
      semanticTags: [],
      useCases: [],
      targetUsers: [],
    },
  });

  it('does not treat CPU, thermal paste, or RGB hubs as assembled desktop PCs', () => {
    const cpu = candidate('cpu', 'CPU Intel Core i5 12400', [
      'Linh kiện máy tính',
      'CPU',
    ]);
    const paste = candidate(
      'paste',
      'Keo tản nhiệt Corsair XTM70 Performance Thermal Paste',
      ['Phụ kiện PC', 'Tản nhiệt'],
    );
    const hub = candidate(
      'hub',
      'Bộ điều khiển quạt và dây đèn RGB Corsair ICUE Link System Hub',
      ['Phụ kiện PC', 'Hub RGB'],
    );
    const desktop = candidate('desktop', 'PC GVN livestream RTX 4060', [
      'PC GVN',
      'PC gaming',
    ]);

    const result = rerankProducts(
      'mình cần pc bộ để livestream',
      [cpu, paste, hub, desktop],
      { constraints: { categoryHints: ['pc'] } },
    );

    expect(result.map((item) => item.productId)).toEqual(['desktop']);
    expect(result[0].reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'category_match' }),
      ]),
    );
  });
});

describe('product reranker desk and chair matching', () => {
  const candidate = (
    productId: string,
    name: string,
    categoryPath: string[],
  ): ProductCandidate => ({
    productId,
    score: 0.7,
    payload: {
      productId,
      name,
      slug: productId,
      category: categoryPath.at(-1) ?? '',
      categoryPath,
      price: 1_000_000,
      discountPrice: 900_000,
      stock: 5,
      isPublished: true,
      isArchived: false,
      semanticTags: [],
      useCases: [],
      targetUsers: [],
    },
  });

  it('maps chair products in shared ban-ghe-gaming taxonomy to chair, not desk', () => {
    const chair = candidate('chair', 'Ghế gaming công thái học', [
      'Phụ kiện',
      'ban-ghe-gaming',
    ]);
    const desk = candidate('desk', 'Bàn gaming livestream 120cm', [
      'Phụ kiện',
      'ban-ghe-gaming',
    ]);

    expect(
      rerankProducts('cần ghế livestream', [chair, desk], {
        constraints: { categoryHints: ['chair'] },
      }).map((item) => item.productId),
    ).toEqual(['chair']);
    expect(
      rerankProducts('cần bàn livestream', [chair, desk], {
        constraints: { categoryHints: ['desk'] },
      }).map((item) => item.productId),
    ).toEqual(['desk']);
  });

  it('does not let a footrest accessory satisfy a chair slot by itself', () => {
    const footrest = candidate('footrest', 'Gác chân công thái học', [
      'Phụ kiện',
      'ban-ghe-gaming',
    ]);

    expect(
      rerankProducts('cần ghế livestream', [footrest], {
        constraints: { categoryHints: ['chair'] },
      }),
    ).toEqual([]);
  });
});
