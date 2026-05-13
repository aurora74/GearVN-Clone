export type ProductFamilyKey =
  | 'laptop'
  | 'phone'
  | 'pc'
  | 'monitor'
  | 'keyboard'
  | 'mouse'
  | 'headset'
  | 'webcam'
  | 'microphone'
  | 'speaker'
  | 'chair'
  | 'desk'
  | 'storage'
  | 'ram'
  | 'cpu'
  | 'gpu'
  | 'mainboard'
  | 'case'
  | 'psu'
  | 'cooling'
  | 'network'
  | 'accessory'
  | 'hub'
  | 'lighting';

export type ProductFamilyDefinition = {
  key: ProductFamilyKey;
  displayLabel: string;
  aliases: string[];
  categoryAliases?: string[];
};

const PC_DESKTOP_ALIASES = [
  'pc',
  'desktop',
  'may bo',
  'máy bộ',
  'may tinh de ban',
  'máy tính để bàn',
  'workstation',
  'linh-kien-may-tinh',
  'linh kien may tinh',
  'linh kiện máy tính',
];

const PC_COMPONENT_ALIASES = [
  'cpu',
  'vga',
  'gpu',
  'card do hoa',
  'card đồ họa',
  'ram',
  'ssd',
  'hdd',
  'o cung',
  'ổ cứng',
  'mainboard',
  'bo mach chu',
  'bo mạch chủ',
  'case may tinh',
  'case máy tính',
  'vo case',
  'vỏ case',
  'nguon may tinh',
  'nguồn máy tính',
  'psu',
  'tan nhiet',
  'tản nhiệt',
];

export const PRODUCT_FAMILY_TAXONOMY: ProductFamilyDefinition[] = [
  {
    key: 'laptop',
    displayLabel: 'laptop',
    aliases: [
      'laptop',
      'laptp',
      'macbook',
      'notebook',
      'may tinh xach tay',
      'máy tính xách tay',
    ],
  },
  {
    key: 'phone',
    displayLabel: 'điện thoại',
    aliases: ['phone', 'dien thoai', 'điện thoại', 'smartphone', 'iphone'],
  },
  {
    key: 'pc',
    displayLabel: 'PC',
    aliases: PC_DESKTOP_ALIASES,
    categoryAliases: [...PC_DESKTOP_ALIASES, ...PC_COMPONENT_ALIASES],
  },
  {
    key: 'monitor',
    displayLabel: 'màn hình',
    aliases: [
      'monitor',
      'man hinh',
      'màn hình',
      'man hinh may tinh',
      'màn hình máy tính',
    ],
  },
  {
    key: 'keyboard',
    displayLabel: 'bàn phím',
    aliases: ['keyboard', 'ban phim', 'bàn phím'],
  },
  {
    key: 'mouse',
    displayLabel: 'chuột',
    aliases: ['mouse', 'chuot', 'chuột'],
  },
  {
    key: 'headset',
    displayLabel: 'tai nghe',
    aliases: [
      'headset',
      'headphone',
      'headphones',
      'tai nghe',
      'earphone',
      'earbuds',
    ],
  },
  {
    key: 'webcam',
    displayLabel: 'webcam',
    aliases: ['webcam', 'camera stream', 'camera livestream'],
  },
  {
    key: 'microphone',
    displayLabel: 'microphone',
    aliases: ['microphone', 'micro', 'mic', 'thu am', 'thu âm'],
  },
  {
    key: 'speaker',
    displayLabel: 'loa',
    aliases: ['speaker', 'loa'],
  },
  {
    key: 'chair',
    displayLabel: 'ghế',
    aliases: ['chair', 'ghe', 'ghế', 'ghe gaming', 'ghế gaming'],
  },
  {
    key: 'desk',
    displayLabel: 'bàn',
    aliases: [
      'desk',
      'table',
      'ban gaming',
      'bàn gaming',
      'ban lam viec',
      'bàn làm việc',
    ],
  },
  {
    key: 'storage',
    displayLabel: 'ổ cứng',
    aliases: ['storage', 'ssd', 'hdd', 'o cung', 'ổ cứng', 'nvme'],
  },
  {
    key: 'ram',
    displayLabel: 'RAM',
    aliases: ['ram', 'memory', 'bo nho', 'bộ nhớ'],
  },
  {
    key: 'cpu',
    displayLabel: 'CPU',
    aliases: ['cpu', 'processor', 'vi xu ly', 'vi xử lý'],
  },
  {
    key: 'gpu',
    displayLabel: 'GPU',
    aliases: ['gpu', 'vga', 'card do hoa', 'card đồ họa', 'graphics card'],
  },
  {
    key: 'mainboard',
    displayLabel: 'mainboard',
    aliases: ['mainboard', 'motherboard', 'bo mach chu', 'bo mạch chủ'],
  },
  {
    key: 'case',
    displayLabel: 'case',
    aliases: ['case', 'case may tinh', 'case máy tính', 'vo case', 'vỏ case'],
  },
  {
    key: 'psu',
    displayLabel: 'nguồn',
    aliases: [
      'psu',
      'nguon',
      'nguồn',
      'nguon may tinh',
      'nguồn máy tính',
      'power supply',
    ],
  },
  {
    key: 'cooling',
    displayLabel: 'tản nhiệt',
    aliases: [
      'cooling',
      'tan nhiet',
      'tản nhiệt',
      'fan',
      'quat tan nhiet',
      'quạt tản nhiệt',
    ],
  },
  {
    key: 'network',
    displayLabel: 'thiết bị mạng',
    aliases: [
      'network',
      'router',
      'wifi',
      'wi fi',
      'mesh',
      'switch mang',
      'switch mạng',
    ],
  },
  {
    key: 'accessory',
    displayLabel: 'phụ kiện',
    aliases: ['accessory', 'accessories', 'phu kien', 'phụ kiện'],
  },
  {
    key: 'hub',
    displayLabel: 'hub/dock',
    aliases: [
      'hub',
      'dock',
      'docking',
      'usb c hub',
      'usb-c hub',
      'hub usb c',
      'type c hub',
    ],
  },
  {
    key: 'lighting',
    displayLabel: 'đèn',
    aliases: [
      'lighting',
      'den',
      'đèn',
      'den led',
      'đèn led',
      'light bar',
      'led',
    ],
  },
];

const FAMILY_BY_KEY = new Map(
  PRODUCT_FAMILY_TAXONOMY.map((family) => [family.key, family]),
);

export function normalizeProductFamilyText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function detectProductFamilyFromText(
  text: string,
): ProductFamilyKey | undefined {
  return detectProductFamiliesFromText(text)[0];
}

export function detectProductFamiliesFromText(
  text: string,
): ProductFamilyKey[] {
  const normalized = normalizeProductFamilyText(text);
  if (!normalized) return [];

  return PRODUCT_FAMILY_TAXONOMY.filter((family) =>
    family.aliases.some((alias) =>
      normalizedTextHasProductFamilyAlias(normalized, alias),
    ),
  ).map((family) => family.key);
}

export function productFamilyDisplayLabel(key: string): string {
  return FAMILY_BY_KEY.get(key as ProductFamilyKey)?.displayLabel ?? key;
}

export function productFamilyAliases(key: string): string[] {
  const family = FAMILY_BY_KEY.get(key as ProductFamilyKey);
  return family ? family.aliases : [key];
}

export function productFamilyCategoryAliases(key: string): string[] {
  const family = FAMILY_BY_KEY.get(key as ProductFamilyKey);
  if (!family) return [key];
  return family.categoryAliases ?? family.aliases;
}

export function normalizedTextHasProductFamilyAlias(
  normalizedText: string,
  alias: string,
): boolean {
  const normalizedAlias = normalizeProductFamilyText(alias);
  if (!normalizedAlias) return false;
  return new RegExp(
    `(^|[^a-z0-9])${escapeRegex(normalizedAlias)}(?=$|[^a-z0-9])`,
  ).test(normalizedText);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
