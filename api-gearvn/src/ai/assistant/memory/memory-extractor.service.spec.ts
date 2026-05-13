import { MemoryExtractorService } from './memory-extractor.service';
import { MemoryExtractionSchema } from './memory-extractor.schema';

describe('MemoryExtractorService', () => {
  it('validates structured extraction fields and keeps ignoredReason', () => {
    const parsed = MemoryExtractionSchema.parse({
      preferences: ['laptop gaming'],
      budgetRange: '25 triệu',
      brandPreferences: [],
      useCases: ['học AI'],
      specPreferences: { gpu: 'RTX' },
      productsOfInterest: [],
      name: 'An',
      phone: '0912345678',
      address: '1 Nguyễn Huệ, Quận 1',
      explicitFields: ['preferences', 'phone', 'address'],
      confidence: { preferences: 0.9, phone: 0.95, address: 0.9 },
      ignoredReason: '',
    });

    expect(parsed.preferences).toEqual(['laptop gaming']);
    expect(parsed.phone).toBe('0912345678');
    expect(parsed.address).toBe('1 Nguyễn Huệ, Quận 1');
    expect(parsed.explicitFields).toContain('phone');
    expect(parsed.ignoredReason).toBe('');
  });

  it('drops missing customer updates and reports a trace-safe reason', async () => {
    const service = new MemoryExtractorService();

    const result = await service.extractMemory({
      customerId: null,
      roomId: 'room-memory-anon',
      userMessage: 'mình thích laptop gaming',
      assistantResponse: 'Mình đã ghi nhận nhu cầu.',
    });

    expect(result.update).toEqual({});
    expect(result.traceEvents[0]).toMatchObject({
      memory_used: [],
      fallback_reason: 'missing_customerId',
    });
  });

  it('filters low-confidence and assistant-derived fields while redacting phone traces', async () => {
    const model = {
      invoke: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          preferences: ['laptop học AI'],
          budgetRange: '25 triệu',
          brandPreferences: [],
          useCases: [],
          specPreferences: {},
          productsOfInterest: [],
          name: '',
          phone: '0912 345 678',
          address: '1 Nguyễn Huệ, Quận 1, TP.HCM',
          explicitFields: ['preferences', 'budgetRange', 'phone', 'address'],
          confidence: {
            preferences: 0.9,
            budgetRange: 0.5,
            phone: 0.95,
            address: 0.95,
          },
          ignoredReason: '',
        }),
      }),
    };
    const service = new MemoryExtractorService(model);

    const result = await service.extractMemory({
      customerId: 'customer-1',
      roomId: 'room-memory-1',
      userMessage: 'mình thích laptop học AI, sđt 0912 345 678',
      assistantResponse: 'Mình đã ghi nhận.',
    });

    expect(result.update).toEqual({
      preferences: ['laptop học AI'],
      phone: '0912345678',
    });
    expect(result.update).not.toHaveProperty('budgetRange');
    expect(result.update).not.toHaveProperty('address');
    expect(JSON.stringify(result.traceEvents)).not.toContain('0912345678');
    expect(JSON.stringify(result.traceEvents)).not.toContain(
      '1 Nguyễn Huệ, Quận 1, TP.HCM',
    );
    expect(result.traceEvents[0].memory_used).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'phone',
          redactedValue: '091****678',
        }),
      ]),
    );
  });
});
