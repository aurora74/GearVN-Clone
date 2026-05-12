import { normalizeDictionaryText } from './product-domain-dictionary';
import { ProductRetrievalConstraints } from './product-retrieval.types';

export const TEACHER_INTENT_PRIMITIVE_IDS = [
  'GAMING',
  'AI_ML_LEARNING',
  'WORK_FROM_HOME',
  'GIFT',
  'STUDENT',
  'CONTENT_CREATION',
  'EYE_COMFORT',
] as const;

export const GEARVN_INTENT_PRIMITIVE_IDS = [
  'OFFICE_PRODUCTIVITY',
  'PORTABLE_WORK',
  'LIVE_STREAMING',
  'VALUE_PERFORMANCE',
] as const;

export type ProductIntentPrimitiveId =
  | (typeof TEACHER_INTENT_PRIMITIVE_IDS)[number]
  | (typeof GEARVN_INTENT_PRIMITIVE_IDS)[number];

export type ProductIntentComboGroup =
  | 'laptop'
  | 'monitor'
  | 'keyboard'
  | 'mouse'
  | 'webcam'
  | 'usb-c-hub'
  | 'headset'
  | 'microphone'
  | 'lighting'
  | 'storage'
  | 'chair'
  | 'accessory'
  | 'pc';

export type ProductIntentPrimitive = {
  id: ProductIntentPrimitiveId;
  terms: string[];
  productGroups: string[];
  hardCriteria: ProductRetrievalConstraints;
  softSignals: string[];
  expandedKeywords: string[];
  comboGroups: ProductIntentComboGroup[];
};

export const PRODUCT_INTENT_PRIMITIVES: Record<
  ProductIntentPrimitiveId,
  ProductIntentPrimitive
> = {
  GAMING: {
    id: 'GAMING',
    terms: [
      'gaming',
      'chơi game',
      'choi game',
      'game thủ',
      'game thu',
      'thích game',
      'thich game',
      'laptop gaming',
    ],
    productGroups: ['laptop', 'pc', 'monitor', 'keyboard', 'mouse', 'headset'],
    hardCriteria: {},
    softSignals: ['fps cao', 'tản nhiệt', 'tan nhiet', 'hiệu năng', 'hieu nang'],
    expandedKeywords: [
      'gaming',
      'RTX',
      'NVIDIA',
      'màn hình 144Hz',
      'tan so quet cao',
      'chuột gaming',
      'bàn phím cơ',
      'game thủ',
    ],
    comboGroups: ['laptop', 'monitor', 'keyboard', 'mouse', 'headset'],
  },
  AI_ML_LEARNING: {
    id: 'AI_ML_LEARNING',
    terms: [
      'laptop học AI',
      'laptop hoc ai',
      'học AI',
      'hoc ai',
      'machine learning',
      'deep learning',
      'lap trinh ai',
      'sinh viên IT',
      'sinh vien it',
    ],
    productGroups: ['laptop'],
    hardCriteria: {
      categoryHints: ['laptop'],
      requiredSpecs: {
        ramGb: 16,
        ssdGb: 512,
        gpu: 'nvidia',
      },
    },
    softSignals: ['lập trình', 'lap trinh', 'nâng cấp RAM', 'học tập'],
    expandedKeywords: [
      'laptop',
      'AI',
      'CUDA',
      'NVIDIA',
      'RTX',
      'RAM 16GB',
      'SSD 512GB',
      'sinh viên IT',
      'machine learning',
    ],
    comboGroups: ['laptop', 'storage'],
  },
  WORK_FROM_HOME: {
    id: 'WORK_FROM_HOME',
    terms: [
      'setup làm việc tại nhà',
      'setup lam viec tai nha',
      'làm việc tại nhà',
      'lam viec tai nha',
      'work from home',
      'góc làm việc',
      'goc lam viec',
      'bộ làm việc tại nhà',
      'bo lam viec tai nha',
    ],
    productGroups: ['laptop', 'monitor', 'keyboard', 'mouse', 'webcam', 'usb-c-hub'],
    hardCriteria: {},
    softSignals: ['ergonomic', 'văn phòng', 'van phong', 'video call', 'đa nhiệm'],
    expandedKeywords: [
      'work from home',
      'văn phòng',
      'monitor',
      'màn hình',
      'bàn phím wireless',
      'chuột wireless',
      'webcam',
      'USB-C hub',
    ],
    comboGroups: ['monitor', 'keyboard', 'mouse', 'webcam', 'usb-c-hub'],
  },
  GIFT: {
    id: 'GIFT',
    terms: [
      'quà',
      'qua',
      'quà tặng',
      'qua tang',
      'mua tặng',
      'mua tang',
      'bạn trai',
      'ban trai',
      'bạn gái',
      'ban gai',
    ],
    productGroups: ['keyboard', 'mouse', 'headset', 'accessory', 'laptop'],
    hardCriteria: {},
    softSignals: ['dễ tặng', 'de tang', 'ngoại hình đẹp', 'gia tot'],
    expandedKeywords: [
      'quà tặng',
      'gift',
      'bạn trai',
      'gaming gear',
      'chuột gaming',
      'bàn phím cơ',
      'tai nghe',
    ],
    comboGroups: ['keyboard', 'mouse', 'headset', 'accessory'],
  },
  STUDENT: {
    id: 'STUDENT',
    terms: ['sinh viên', 'sinh vien', 'student', 'học tập', 'hoc tap', 'đi học'],
    productGroups: ['laptop'],
    hardCriteria: {
      categoryHints: ['laptop'],
    },
    softSignals: ['giá tốt', 'gia tot', 'pin tốt', 'mỏng nhẹ', 'bền bỉ'],
    expandedKeywords: [
      'sinh viên',
      'học tập',
      'laptop sinh viên',
      'giá tốt',
      'mỏng nhẹ',
      'RAM 16GB',
      'SSD 512GB',
    ],
    comboGroups: ['laptop', 'accessory'],
  },
  CONTENT_CREATION: {
    id: 'CONTENT_CREATION',
    terms: [
      'content creation',
      'creator',
      'làm đồ họa',
      'lam do hoa',
      'render',
      'thiết kế',
      'thiet ke',
      'edit video',
    ],
    productGroups: ['laptop', 'pc', 'monitor'],
    hardCriteria: {
      requiredSpecs: {
        ramGb: 16,
        gpu: 'nvidia',
      },
    },
    softSignals: ['màn hình màu chuẩn', 'do phu mau', 'render nhanh'],
    expandedKeywords: [
      'creator',
      'đồ họa',
      'render',
      'RTX',
      'NVIDIA',
      'RAM 16GB',
      'màn hình màu chuẩn',
    ],
    comboGroups: ['laptop', 'monitor', 'storage'],
  },
  EYE_COMFORT: {
    id: 'EYE_COMFORT',
    terms: [
      'mỏi mắt',
      'moi mat',
      'đỡ mỏi mắt',
      'do moi mat',
      'bảo vệ mắt',
      'bao ve mat',
      'eye comfort',
      'flicker free',
    ],
    productGroups: ['monitor'],
    hardCriteria: {
      categoryHints: ['monitor'],
    },
    softSignals: ['flicker free', 'low blue light', 'IPS', 'chống chói'],
    expandedKeywords: [
      'monitor',
      'màn hình',
      'eye comfort',
      'bảo vệ mắt',
      'IPS',
      'flicker free',
      'low blue light',
    ],
    comboGroups: ['monitor'],
  },
  OFFICE_PRODUCTIVITY: {
    id: 'OFFICE_PRODUCTIVITY',
    terms: ['văn phòng', 'van phong', 'office', 'năng suất', 'nang suat'],
    productGroups: ['laptop', 'keyboard', 'mouse', 'monitor'],
    hardCriteria: {},
    softSignals: ['pin tốt', 'bền bỉ', 'đa nhiệm', 'webcam'],
    expandedKeywords: [
      'văn phòng',
      'office',
      'pin tốt',
      'bàn phím wireless',
      'chuột wireless',
      'webcam',
    ],
    comboGroups: ['laptop', 'monitor', 'keyboard', 'mouse'],
  },
  PORTABLE_WORK: {
    id: 'PORTABLE_WORK',
    terms: ['mỏng nhẹ', 'mong nhe', 'di động', 'di dong', 'portable', 'ultrabook'],
    productGroups: ['laptop'],
    hardCriteria: {
      categoryHints: ['laptop'],
    },
    softSignals: ['pin tốt', 'nhẹ', 'thin light', 'usb-c'],
    expandedKeywords: ['mỏng nhẹ', 'thin light', 'ultrabook', 'pin tốt', 'USB-C'],
    comboGroups: ['laptop', 'usb-c-hub'],
  },
  LIVE_STREAMING: {
    id: 'LIVE_STREAMING',
    terms: ['góc livestream', 'goc livestream', 'livestream', 'streaming', 'streamer'],
    productGroups: ['webcam', 'microphone', 'lighting', 'headset'],
    hardCriteria: {},
    softSignals: ['âm thanh rõ', 'ánh sáng', 'video call', 'creator'],
    expandedKeywords: [
      'góc livestream',
      'webcam',
      'micro',
      'microphone',
      'đèn led',
      'creator',
      'headset',
    ],
    comboGroups: ['webcam', 'microphone', 'lighting', 'headset'],
  },
  VALUE_PERFORMANCE: {
    id: 'VALUE_PERFORMANCE',
    terms: ['máy mạnh giá tốt', 'may manh gia tot', 'giá tốt', 'gia tot', 'best value'],
    productGroups: ['laptop', 'pc'],
    hardCriteria: {},
    softSignals: ['hiệu năng', 'hieu nang', 'khuyến mãi', 'p/p tốt'],
    expandedKeywords: ['hiệu năng', 'giá tốt', 'best value', 'khuyến mãi', 'sale'],
    comboGroups: ['laptop', 'pc'],
  },
};

export function detectIntentPrimitives(query: string): ProductIntentPrimitive[] {
  const normalized = normalizeDictionaryText(query);
  if (!normalized) return [];

  return ALL_PRODUCT_INTENT_PRIMITIVES.filter((primitive) =>
    primitive.terms.some((term) =>
      normalized.includes(normalizeDictionaryText(term)),
    ),
  );
}

export function expandWithIntentPrimitives(query: string): string[] {
  const expansions = new Set<string>();

  for (const primitive of detectIntentPrimitives(query)) {
    primitive.terms.forEach((term) => expansions.add(term));
    primitive.productGroups.forEach((term) => expansions.add(term));
    primitive.softSignals.forEach((term) => expansions.add(term));
    primitive.expandedKeywords.forEach((term) => expansions.add(term));
    primitive.comboGroups.forEach((term) => expansions.add(term));
  }

  return uniqueStrings(Array.from(expansions));
}

export function constraintsFromIntentPrimitives(
  query: string,
): ProductRetrievalConstraints {
  return detectIntentPrimitives(query).reduce<ProductRetrievalConstraints>(
    (constraints, primitive) =>
      mergePrimitiveConstraints(constraints, {
        categoryHints: primitive.productGroups,
        ...primitive.hardCriteria,
      }),
    {},
  );
}

export function comboGroupsFromIntentPrimitives(
  query: string,
): ProductIntentComboGroup[] {
  const groups = detectIntentPrimitives(query).flatMap(
    (primitive) => primitive.comboGroups,
  );
  return uniqueStrings(groups) as ProductIntentComboGroup[];
}

const ALL_PRODUCT_INTENT_PRIMITIVES = [
  ...TEACHER_INTENT_PRIMITIVE_IDS,
  ...GEARVN_INTENT_PRIMITIVE_IDS,
].map((id) => PRODUCT_INTENT_PRIMITIVES[id]);

function mergePrimitiveConstraints(
  left: ProductRetrievalConstraints,
  right: ProductRetrievalConstraints,
): ProductRetrievalConstraints {
  return {
    ...left,
    ...right,
    categoryHints: uniqueStrings([
      ...(left.categoryHints ?? []),
      ...(right.categoryHints ?? []),
    ]),
    categoryPath: uniqueStrings([
      ...(left.categoryPath ?? []),
      ...(right.categoryPath ?? []),
    ]),
    semanticTags: uniqueStrings([
      ...(left.semanticTags ?? []),
      ...(right.semanticTags ?? []),
    ]),
    useCases: uniqueStrings([...(left.useCases ?? []), ...(right.useCases ?? [])]),
    targetUsers: uniqueStrings([
      ...(left.targetUsers ?? []),
      ...(right.targetUsers ?? []),
    ]),
    requiredSpecs: {
      ...(left.requiredSpecs ?? {}),
      ...(right.requiredSpecs ?? {}),
    },
  };
}

function uniqueStrings<T extends string>(values: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const text = String(value ?? '').trim() as T;
    const key = normalizeDictionaryText(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result;
}
