import { z } from 'zod';

export const ResponseMergePlanSchema = z.object({
  finalMessage: z.string().min(1),
  priorityOrder: z.array(z.string()).default([]),
  selectedResponseIds: z.array(z.string()).default([]),
  droppedDuplicateResponseIds: z.array(z.string()).default([]),
  metadataPreserved: z.array(z.string()).default([]),
  factSources: z.array(z.string()).default([]),
  unsupportedReason: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ResponseMergePlan = z.infer<typeof ResponseMergePlanSchema>;

export const ResponseMergePlanJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'finalMessage',
    'priorityOrder',
    'selectedResponseIds',
    'droppedDuplicateResponseIds',
    'metadataPreserved',
    'factSources',
    'confidence',
  ],
  properties: {
    finalMessage: { type: 'string' },
    priorityOrder: { type: 'array', items: { type: 'string' } },
    selectedResponseIds: { type: 'array', items: { type: 'string' } },
    droppedDuplicateResponseIds: { type: 'array', items: { type: 'string' } },
    metadataPreserved: { type: 'array', items: { type: 'string' } },
    factSources: { type: 'array', items: { type: 'string' } },
    unsupportedReason: { type: ['string', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
} as const;
