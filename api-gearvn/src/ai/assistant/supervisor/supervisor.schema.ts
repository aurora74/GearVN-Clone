import { z } from 'zod';

export const SupervisorRouteSchema = z.enum(['sales', 'order', 'general']);

export const SupervisorDecisionSchema = z.object({
  route: SupervisorRouteSchema,
  confidence: z.number().min(0).max(1),
  intents: z.array(z.string()),
  entities: z.record(z.string(), z.unknown()).default({}),
  memoryRefs: z.array(z.string()).default([]),
  fallbackReason: z.string().optional(),
  modelName: z.string(),
});

export type SupervisorDecisionPayload = z.infer<
  typeof SupervisorDecisionSchema
>;

export const SupervisorDecisionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['route', 'confidence', 'intents', 'entities', 'memoryRefs', 'modelName'],
  properties: {
    route: { enum: ['sales', 'order', 'general'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    intents: { type: 'array', items: { type: 'string' } },
    entities: { type: 'object', additionalProperties: true },
    memoryRefs: { type: 'array', items: { type: 'string' } },
    fallbackReason: { type: 'string' },
    modelName: { type: 'string' },
  },
} as const;
