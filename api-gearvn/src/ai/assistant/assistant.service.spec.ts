import { AiAssistantModule } from './ai-assistant.module';
import { AssistantService } from './assistant.service';
import { AssistantSessionService } from './assistant-session.service';
import { AssistantTraceService } from './assistant-trace.service';
import { AssistantMode } from './assistant.types';

describe('AssistantService', () => {
  const makeService = (
    mode: AssistantMode,
    graphInvoke = jest.fn(),
    overrides: {
      customerProfileService?: unknown;
      memoryExtractorService?: unknown;
    } = {},
  ) => {
    const sessionService = {
      getMode: jest.fn().mockResolvedValue(mode),
      buildPromptContext: jest.fn().mockResolvedValue({
        roomId: 'room-client-1',
        threadId: 'ai-chat-room-client-1',
        mode,
        sections: [{ kind: 'hotMessages', content: 'user: laptop gaming' }],
      }),
      appendHotMessage: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<AssistantSessionService>;
    const traceService = {
      redactTraceMetadata: jest.fn((metadata) => metadata),
    } as unknown as jest.Mocked<AssistantTraceService>;

    return {
      service: new AssistantService(
        sessionService,
        traceService,
        graphInvoke as any,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        overrides.customerProfileService as any,
        overrides.memoryExtractorService as any,
      ),
      sessionService,
      traceService,
      graphInvoke,
    };
  };

  it('pauses staff-mode rooms without invoking graph/model/retrieval work', async () => {
    const { service, sessionService, graphInvoke } = makeService(
      AssistantMode.STAFF,
    );

    await expect(
      service.invokeForChatMessage({
        roomId: 'room-client-1',
        authenticatedUserId: 'customer-1',
        text: 'Toi dang noi voi nhan vien',
        attachments: [],
      }),
    ).resolves.toMatchObject({
      status: 'staff_mode_paused',
      metadata: {
        mode: AssistantMode.STAFF,
      },
    });

    expect(sessionService.buildPromptContext).not.toHaveBeenCalled();
    expect(graphInvoke).not.toHaveBeenCalled();
  });

  it('invokes the shopping graph with room-scoped thread_id and prompt context', async () => {
    const graphInvoke = jest.fn().mockResolvedValue({
      status: 'completed',
      text: 'San pham phu hop.',
      routeTrace: ['classify_intent', 'product_advice', 'merge_response'],
      traceEvents: [{ node: 'product_advice', roomId: 'room-client-1' }],
      metadata: { productCards: [] },
    });
    const { service, sessionService, traceService } = makeService(
      AssistantMode.AI,
      graphInvoke,
    );

    await expect(
      service.invokeForChatMessage({
        roomId: 'room-client-1',
        authenticatedUserId: 'customer-1',
        text: 'Tu van laptop gaming',
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      text: 'San pham phu hop.',
      metadata: {
        mode: AssistantMode.AI,
        trace: [{ node: 'product_advice', roomId: 'room-client-1' }],
      },
    });

    expect(sessionService.appendHotMessage).toHaveBeenCalledWith(
      'room-client-1',
      expect.objectContaining({
        role: 'customer',
        text: 'Tu van laptop gaming',
      }),
    );
    expect(sessionService.appendHotMessage).toHaveBeenCalledWith(
      'room-client-1',
      expect.objectContaining({ role: 'assistant', text: 'San pham phu hop.' }),
    );
    expect(sessionService.buildPromptContext).toHaveBeenCalledWith(
      'room-client-1',
    );
    expect(graphInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-client-1',
        customerId: 'customer-1',
        authenticatedUserId: 'customer-1',
        userText: 'Tu van laptop gaming',
      }),
      expect.objectContaining({
        configurable: expect.objectContaining({
          thread_id: 'ai-chat-room-client-1',
          promptContext: expect.objectContaining({
            threadId: 'ai-chat-room-client-1',
          }),
        }),
      }),
    );
    expect(traceService.redactTraceMetadata).toHaveBeenCalledWith({
      node: 'product_advice',
      roomId: 'room-client-1',
    });
  });

  it('skips durable memory extraction for greeting-only guidance replies', async () => {
    const graphInvoke = jest.fn().mockResolvedValue({
      status: 'completed',
      text: 'Chào bạn, mình là GearVN AI. Bạn đang cần mình hỗ trợ gì?',
      traceEvents: [
        {
          node: 'supervisor',
          roomId: 'room-client-1',
          fallback_reason: 'greeting_guidance',
        },
      ],
      metadata: { fallback_reason: 'greeting_guidance' },
    });
    const customerProfileService = {
      buildRedactedPromptSection: jest.fn().mockResolvedValue(null),
      getForPrompt: jest.fn(),
      mergeExtractedMemory: jest.fn(),
    };
    const memoryExtractorService = {
      extractMemory: jest.fn(),
    };
    const { service } = makeService(AssistantMode.AI, graphInvoke, {
      customerProfileService,
      memoryExtractorService,
    });

    const result = await service.invokeForChatMessage({
      roomId: 'room-client-1',
      authenticatedUserId: 'customer-1',
      text: 'chào bạn',
    });

    expect(result.text).toContain('GearVN AI');
    expect(customerProfileService.getForPrompt).not.toHaveBeenCalled();
    expect(memoryExtractorService.extractMemory).not.toHaveBeenCalled();
    expect(result.metadata.trace).toEqual([
      {
        node: 'supervisor',
        roomId: 'room-client-1',
        fallback_reason: 'greeting_guidance',
      },
    ]);
  });

  it('skips durable memory extraction for ordinary catalog questions without preference signals', async () => {
    const graphInvoke = jest.fn().mockResolvedValue({
      status: 'completed',
      text: 'Mình tìm thấy một số sản phẩm phù hợp từ catalog GearVN.',
      traceEvents: [{ node: 'product_advice', roomId: 'room-client-1' }],
      metadata: {
        active_subgraph: 'sales',
        productCards: [{ productId: 'p1' }],
      },
    });
    const customerProfileService = {
      buildRedactedPromptSection: jest.fn().mockResolvedValue(null),
      getForPrompt: jest.fn(),
      mergeExtractedMemory: jest.fn(),
    };
    const memoryExtractorService = {
      extractMemory: jest.fn(),
    };
    const { service } = makeService(AssistantMode.AI, graphInvoke, {
      customerProfileService,
      memoryExtractorService,
    });

    await service.invokeForChatMessage({
      roomId: 'room-client-1',
      authenticatedUserId: 'customer-1',
      text: 'có laptop nào không bạn',
    });

    expect(customerProfileService.getForPrompt).not.toHaveBeenCalled();
    expect(memoryExtractorService.extractMemory).not.toHaveBeenCalled();
  });

  it('extracts durable memory from normal shopping priorities', async () => {
    const graphInvoke = jest.fn().mockResolvedValue({
      status: 'completed',
      text: 'Mình tìm thấy laptop phù hợp cho nhu cầu AI.',
      traceEvents: [{ node: 'product_advice', roomId: 'room-client-1' }],
      metadata: {
        active_subgraph: 'sales',
        productCards: [{ productId: 'p1' }],
      },
    });
    const customerProfileService = {
      buildRedactedPromptSection: jest.fn().mockResolvedValue(null),
      getForPrompt: jest.fn().mockResolvedValue({ preferences: {} }),
      mergeExtractedMemory: jest.fn(),
    };
    const memoryExtractorService = {
      extractMemory: jest.fn().mockResolvedValue({
        update: { preferences: { budget: '25 triệu', useCase: 'AI' } },
        traceEvents: [
          {
            node: 'memory_extractor',
            roomId: 'room-client-1',
            memory_used: true,
          },
        ],
      }),
    };
    const { service } = makeService(AssistantMode.AI, graphInvoke, {
      customerProfileService,
      memoryExtractorService,
    });

    await service.invokeForChatMessage({
      roomId: 'room-client-1',
      authenticatedUserId: 'customer-1',
      text: 'Ngân sách 25 triệu, dùng để học machine learning/AI, ưu tiên hiệu năng',
    });

    expect(customerProfileService.getForPrompt).toHaveBeenCalledWith(
      'customer-1',
    );
    expect(memoryExtractorService.extractMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage:
          'Ngân sách 25 triệu, dùng để học machine learning/AI, ưu tiên hiệu năng',
      }),
    );
    expect(customerProfileService.mergeExtractedMemory).toHaveBeenCalled();
  });

  it('schedules memory_extraction_scheduled best-effort without awaiting the 8000ms response-path timeout', async () => {
    const graphInvoke = jest.fn().mockResolvedValue({
      status: 'completed',
      text: 'Mình tìm thấy laptop phù hợp cho nhu cầu AI.',
      traceEvents: [{ node: 'product_advice', roomId: 'room-client-1' }],
      metadata: {
        active_subgraph: 'sales',
        productCards: [{ productId: 'p1' }],
      },
    });
    let releaseMemoryRead: (profile: { preferences: Record<string, unknown> }) => void =
      () => undefined;
    const customerProfileService = {
      buildRedactedPromptSection: jest.fn().mockResolvedValue(null),
      getForPrompt: jest.fn(
        () =>
          new Promise((resolve) => {
            releaseMemoryRead = resolve;
          }),
      ),
      mergeExtractedMemory: jest.fn(),
    };
    const memoryExtractorService = {
      extractMemory: jest.fn().mockResolvedValue({
        update: { preferences: { budget: '25 triệu' } },
        traceEvents: [
          {
            node: 'memory_extractor',
            memory_extraction_scheduled: true,
          },
        ],
      }),
    };
    const { service } = makeService(AssistantMode.AI, graphInvoke, {
      customerProfileService,
      memoryExtractorService,
    });

    const invocation = service.invokeForChatMessage({
      roomId: 'room-client-1',
      authenticatedUserId: 'customer-1',
      text: 'Ngân sách 25 triệu, dùng để học machine learning/AI',
    });
    let resolvedBeforeMemory = false;
    invocation.then(() => {
      resolvedBeforeMemory = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
    const wasResolvedBeforeMemoryRead = resolvedBeforeMemory;

    releaseMemoryRead({ preferences: {} });
    await invocation;

    expect(memoryExtractorService.extractMemory).toHaveBeenCalled();
    expect(wasResolvedBeforeMemoryRead).toBe(true);
  });

  it('records memory_extraction_failed trace evidence without changing the customer response', async () => {
    const graphInvoke = jest.fn().mockResolvedValue({
      status: 'completed',
      text: 'Mình tìm thấy laptop phù hợp cho nhu cầu AI.',
      traceEvents: [{ node: 'product_advice', roomId: 'room-client-1' }],
      metadata: {
        active_subgraph: 'sales',
        productCards: [{ productId: 'p1' }],
      },
    });
    const customerProfileService = {
      buildRedactedPromptSection: jest.fn().mockResolvedValue(null),
      getForPrompt: jest.fn().mockResolvedValue({ preferences: {} }),
      mergeExtractedMemory: jest.fn(),
    };
    const memoryExtractorService = {
      extractMemory: jest.fn().mockRejectedValue(new Error('memory failed')),
    };
    const { service } = makeService(AssistantMode.AI, graphInvoke, {
      customerProfileService,
      memoryExtractorService,
    });

    const result = await service.invokeForChatMessage({
      roomId: 'room-client-1',
      authenticatedUserId: 'customer-1',
      text: 'Ngân sách 25 triệu, dùng để học machine learning/AI',
    });

    expect(result.text).toBe('Mình tìm thấy laptop phù hợp cho nhu cầu AI.');
    expect(result.metadata.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node: 'memory_extractor',
          memory_extraction_scheduled: true,
          fallback_reason: 'memory_extraction_failed',
        }),
      ]),
    );
  });
  it('keeps durable memory extraction for explicit preference signals', async () => {
    const graphInvoke = jest.fn().mockResolvedValue({
      status: 'completed',
      text: 'Mình đã ghi nhận ưu tiên laptop pin tốt.',
      traceEvents: [{ node: 'product_advice', roomId: 'room-client-1' }],
      metadata: { active_subgraph: 'sales' },
    });
    const customerProfileService = {
      buildRedactedPromptSection: jest.fn().mockResolvedValue(null),
      getForPrompt: jest.fn().mockResolvedValue({ preferences: {} }),
      mergeExtractedMemory: jest.fn(),
    };
    const memoryExtractorService = {
      extractMemory: jest.fn().mockResolvedValue({
        update: { preferences: { laptop: 'pin tốt' } },
        traceEvents: [
          {
            node: 'memory_extractor',
            roomId: 'room-client-1',
            memory_used: true,
          },
        ],
      }),
    };
    const { service } = makeService(AssistantMode.AI, graphInvoke, {
      customerProfileService,
      memoryExtractorService,
    });

    await service.invokeForChatMessage({
      roomId: 'room-client-1',
      authenticatedUserId: 'customer-1',
      text: 'lần sau nhớ là mình ưu tiên laptop pin tốt',
    });

    expect(memoryExtractorService.extractMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: 'lần sau nhớ là mình ưu tiên laptop pin tốt',
      }),
    );
    expect(customerProfileService.mergeExtractedMemory).toHaveBeenCalled();
  });

  it('registers assistant service and adapter providers without public controllers', () => {
    const providers = Reflect.getMetadata(
      'providers',
      AiAssistantModule,
    ) as unknown[];
    const controllers =
      (Reflect.getMetadata('controllers', AiAssistantModule) as unknown[]) ??
      [];
    const providerNames = providers.map((provider) =>
      typeof provider === 'function'
        ? provider.name
        : String((provider as any)?.provide ?? provider),
    );

    expect(providerNames).toEqual(
      expect.arrayContaining([
        'AssistantService',
        'ProductCatalogAdapter',
        'ReviewSearchClient',
        'AssistantActionAdapter',
        'VoucherAdapter',
        'OrderLookupAdapter',
        'SupportHandoffAdapter',
        'StaffHandoffSummaryService',
        'AssistantResponseComposer',
      ]),
    );
    expect(controllers).toEqual([]);
  });
});
