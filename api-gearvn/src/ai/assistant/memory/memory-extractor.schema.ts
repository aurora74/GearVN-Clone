import { z } from 'zod';

export const MemoryExtractionSchema = z.object({
  preferences: z.array(z.string()).default([]),
  budgetRange: z.string().optional().default(''),
  brandPreferences: z.array(z.string()).default([]),
  useCases: z.array(z.string()).default([]),
  specPreferences: z.record(z.string(), z.unknown()).default({}),
  productsOfInterest: z.array(z.string()).default([]),
  name: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  address: z.string().optional().default(''),
  explicitFields: z.array(z.string()).default([]),
  confidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
  ignoredReason: z.string().optional().default(''),
});

export type MemoryExtraction = z.infer<typeof MemoryExtractionSchema>;

export const MemoryExtractionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'preferences',
    'budgetRange',
    'brandPreferences',
    'useCases',
    'specPreferences',
    'productsOfInterest',
    'name',
    'phone',
    'address',
    'explicitFields',
    'confidence',
    'ignoredReason',
  ],
  properties: {
    preferences: { type: 'array', items: { type: 'string' } },
    budgetRange: { type: 'string' },
    brandPreferences: { type: 'array', items: { type: 'string' } },
    useCases: { type: 'array', items: { type: 'string' } },
    specPreferences: { type: 'object', additionalProperties: true },
    productsOfInterest: { type: 'array', items: { type: 'string' } },
    name: { type: 'string' },
    phone: { type: 'string' },
    address: { type: 'string' },
    explicitFields: { type: 'array', items: { type: 'string' } },
    confidence: {
      type: 'object',
      additionalProperties: { type: 'number', minimum: 0, maximum: 1 },
    },
    ignoredReason: { type: 'string' },
  },
} as const;
