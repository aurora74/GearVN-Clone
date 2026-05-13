import {
  detectProductFamiliesFromText,
  productFamilyCategoryAliases,
  productFamilyDisplayLabel,
} from './product-family-taxonomy';

export type TechProductQueryDictionaryEntry = {
  terms: string[];
  expansions: string[];
};

export const TECH_PRODUCT_QUERY_DICTIONARY: TechProductQueryDictionaryEntry[] =
  [
    {
      terms: [
        'laptop ai',
        'học ai',
        'hoc ai',
        'machine learning',
        'deep learning',
      ],
      expansions: [
        'laptop',
        'AI',
        'CUDA',
        'NVIDIA',
        'RTX',
        'RAM 16GB',
        'sinh viên IT',
      ],
    },
    {
      terms: ['laptop gaming', 'gaming laptop', 'chơi game', 'choi game'],
      expansions: [
        'laptop gaming',
        'RTX',
        'NVIDIA',
        'tản nhiệt',
        'màn hình 144Hz',
        'game thủ',
      ],
    },
    {
      terms: [
        'rtx',
        'rtx 3050',
        'rtx 4050',
        'rtx 4060',
        'rtx 4070',
        'rtx 4080',
        'rtx 4090',
      ],
      expansions: [
        'GPU rời',
        'NVIDIA GeForce',
        'CUDA',
        'đồ họa',
        'gaming',
        'render',
      ],
    },
    {
      terms: ['nvidia', 'cuda', 'geforce'],
      expansions: ['NVIDIA', 'CUDA', 'RTX', 'GPU', 'VGA', 'AI', 'render'],
    },
    {
      terms: ['cpu', 'vi xử lý', 'vi xu ly', 'processor'],
      expansions: ['Intel Core', 'AMD Ryzen', 'CPU', 'hiệu năng', 'đa nhiệm'],
    },
    {
      terms: ['gpu', 'vga', 'card đồ họa', 'card do hoa', 'graphics'],
      expansions: ['GPU', 'VGA', 'RTX', 'NVIDIA', 'đồ họa', 'render', 'gaming'],
    },
    {
      terms: ['ram', 'memory', 'bộ nhớ', 'bo nho'],
      expansions: [
        'RAM 8GB',
        'RAM 16GB',
        'RAM 32GB',
        'đa nhiệm',
        'DDR4',
        'DDR5',
      ],
    },
    {
      terms: ['ssd', 'nvme', 'ổ cứng', 'o cung', 'storage'],
      expansions: ['SSD', 'NVMe', '512GB', '1TB', 'lưu trữ', 'tốc độ cao'],
    },
    {
      terms: ['màn hình', 'man hinh', 'oled', 'ips', 'hz', '144hz', '165hz'],
      expansions: [
        'màn hình',
        'monitor',
        'OLED',
        'IPS',
        'tần số quét',
        'độ phủ màu',
      ],
    },
    {
      terms: ['sinh viên', 'sinh vien', 'student'],
      expansions: [
        'sinh viên',
        'học tập',
        'laptop sinh viên',
        'giá tốt',
        'mỏng nhẹ',
      ],
    },
    {
      terms: ['văn phòng', 'van phong', 'office'],
      expansions: [
        'văn phòng',
        'office',
        'pin tốt',
        'mỏng nhẹ',
        'bền bỉ',
        'webcam',
      ],
    },
    {
      terms: ['cad', 'autocad', 'kỹ thuật', 'ky thuat', 'solidworks', 'revit'],
      expansions: [
        'CAD',
        'AutoCAD',
        'workstation',
        'PC',
        'RTX',
        'NVIDIA',
        'RAM 16GB',
        'render',
      ],
    },
    {
      terms: ['đồ họa', 'do hoa', 'render', 'creator', 'thiết kế', 'thiet ke'],
      expansions: [
        'đồ họa',
        'render',
        'creator',
        'RTX',
        'màn hình màu chuẩn',
        'RAM 16GB',
      ],
    },
    {
      terms: ['mỏng nhẹ', 'mong nhe', 'thin light', 'ultrabook'],
      expansions: ['mỏng nhẹ', 'thin light', 'ultrabook', 'pin tốt', 'di động'],
    },
    {
      terms: ['pin', 'battery', 'thời lượng pin', 'thoi luong pin'],
      expansions: [
        'pin tốt',
        'battery',
        'tiết kiệm điện',
        'văn phòng',
        'mỏng nhẹ',
      ],
    },
    {
      terms: ['tai nghe', 'headphone', 'headset'],
      expansions: [
        'tai nghe',
        'headset',
        'gaming headset',
        'micro',
        'không dây',
      ],
    },
    {
      terms: ['bàn phím', 'ban phim', 'keyboard'],
      expansions: [
        'bàn phím',
        'keyboard',
        'bàn phím cơ',
        'wireless',
        'bluetooth',
      ],
    },
    {
      terms: ['chuột', 'chuot', 'mouse'],
      expansions: ['chuột', 'mouse', 'chuột gaming', 'wireless', 'DPI'],
    },
    {
      terms: ['monitor', 'màn hình máy tính', 'man hinh may tinh'],
      expansions: [
        'màn hình',
        'monitor',
        'IPS',
        'OLED',
        '144Hz',
        'eye comfort',
      ],
    },
    {
      terms: [
        'asus',
        'rog',
        'tuf',
        'acer',
        'nitro',
        'predator',
        'msi',
        'lenovo',
        'legion',
        'loq',
        'hp',
        'victus',
        'omen',
        'dell',
        'alienware',
        'gigabyte',
        'aorus',
        'apple',
        'macbook',
      ],
      expansions: [
        'laptop',
        'thương hiệu laptop',
        'gaming',
        'văn phòng',
        'creator',
      ],
    },
  ];

export function expandWithTechDictionary(query: string): string[] {
  const normalized = normalizeDictionaryText(query);
  const expansions = new Set<string>();

  for (const family of detectProductFamiliesFromText(query)) {
    expansions.add(family);
    expansions.add(productFamilyDisplayLabel(family));
    productFamilyCategoryAliases(family).forEach((alias) =>
      expansions.add(alias),
    );
  }

  for (const entry of TECH_PRODUCT_QUERY_DICTIONARY) {
    if (
      entry.terms.some((term) =>
        normalized.includes(normalizeDictionaryText(term)),
      )
    ) {
      entry.terms.forEach((term) => expansions.add(term));
      entry.expansions.forEach((term) => expansions.add(term));
    }
  }

  return Array.from(expansions).filter(Boolean);
}

export function normalizeDictionaryText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
