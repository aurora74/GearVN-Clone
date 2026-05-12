import { BenchmarkCase } from './product-retrieval.types';

export const productRetrievalBenchmarkCases: BenchmarkCase[] = [
  {
    id: 'keyword-iphone',
    query: 'iPhone',
    group: 'keyword',
    expectedCategories: ['phone', 'dien-thoai'],
  },
  {
    id: 'keyword-macbook',
    query: 'MacBook',
    group: 'keyword',
    expectedCategories: ['laptop'],
  },
  {
    id: 'keyword-rtx-laptop',
    query: 'RTX laptop',
    group: 'keyword',
    expectedCategories: ['laptop'],
  },
  {
    id: 'keyword-dell-monitor',
    query: 'màn hình Dell',
    group: 'keyword',
    expectedCategories: ['monitor', 'man-hinh'],
  },
  {
    id: 'need-ai-laptop',
    query: 'laptop học AI',
    group: 'need_based',
    expectedCategories: ['laptop'],
    hardConstraints: { categoryHints: ['laptop'] },
  },
  {
    id: 'need-graphics',
    query: 'máy làm đồ họa',
    group: 'need_based',
    expectedCategories: ['laptop', 'desktop'],
  },
  {
    id: 'need-home-office',
    query: 'setup làm việc tại nhà',
    group: 'need_based',
    expectedCategories: ['monitor', 'man-hinh', 'keyboard', 'mouse', 'webcam'],
  },
  {
    id: 'need-eye-comfort',
    query: 'màn hình đỡ mỏi mắt',
    group: 'need_based',
    expectedCategories: ['monitor', 'man-hinh'],
  },
  {
    id: 'gift-gamer-boyfriend',
    query: 'quà cho bạn trai thích game',
    group: 'gift',
    expectedCategories: ['keyboard', 'mouse', 'headset', 'headphone', 'laptop', 'phu-kien'],
  },
  {
    id: 'gift-it-student',
    query: 'quà cho sinh viên IT',
    group: 'gift',
    expectedCategories: ['laptop', 'keyboard', 'mouse', 'phu-kien'],
  },
  {
    id: 'technical-ai-laptop-specs',
    query: 'laptop RAM 16GB SSD 512GB GPU NVIDIA',
    group: 'technical',
    expectedCategories: ['laptop'],
    hardConstraints: {
      categoryHints: ['laptop'],
      requiredSpecs: { ramGb: 16, ssdGb: 512, gpu: 'nvidia' },
    },
  },
  {
    id: 'technical-monitor-144hz',
    query: 'màn hình 144Hz',
    group: 'technical',
    expectedCategories: ['monitor', 'man-hinh'],
    hardConstraints: {
      categoryHints: ['monitor', 'man-hinh'],
      requiredSpecs: { refreshRateHz: 144 },
    },
  },
  {
    id: 'technical-wireless-keyboard',
    query: 'bàn phím cơ wireless',
    group: 'technical',
    expectedCategories: ['keyboard', 'ban-phim', 'phu-kien'],
    hardConstraints: {
      categoryHints: ['keyboard', 'ban-phim'],
      requiredSpecs: { wireless: true },
    },
  },
  {
    id: 'combo-livestream',
    query: 'góc livestream',
    group: 'combo',
    expectedCategories: ['webcam', 'microphone', 'micro', 'lighting', 'den-led', 'monitor', 'man-hinh', 'phu-kien'],
  },
  {
    id: 'combo-home-work-kit',
    query: 'bộ làm việc tại nhà',
    group: 'combo',
    expectedCategories: ['monitor', 'man-hinh', 'keyboard', 'mouse', 'webcam', 'phu-kien'],
  },
  {
    id: 'ambiguous-strong-value',
    query: 'máy mạnh giá tốt',
    group: 'ambiguous',
    expectedCategories: ['laptop', 'desktop', 'pc', 'linh-kien-may-tinh'],
  },
];
