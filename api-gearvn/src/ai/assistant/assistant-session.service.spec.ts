import { AiModule } from '../ai.module';
import { AiAssistantModule } from './ai-assistant.module';
import { AssistantSessionService } from './assistant-session.service';
import {
  AssistantSession,
  AssistantSessionSchema,
} from './assistant-session.schema';
import {
  AssistantActionDraft,
  AssistantIntent,
  AssistantMessageMetadata,
  AssistantMode,
} from './assistant.types';
import { ShoppingAssistantState } from './shopping-assistant.state';
import {
  assertAssistantModelCapabilities,
  readAssistantModelConfig,
} from './config/assistant-model.config';
import { AssistantTraceService } from './assistant-trace.service';
import {
  CustomerAssistantProfile,
  CustomerAssistantProfileSchema,
} from './memory/customer-assistant-profile.schema';
import { CustomerAssistantProfileService } from './memory/customer-assistant-profile.service';

const createSessionModel = () => {
  const store = new Map<string, any>();

  const model: any = jest.fn().mockImplementation((data) => ({
    hotMessages: [],
    progressiveSummary: {},
    pendingActionDrafts: [],
    ...data,
    save: jest.fn().mockImplementation(async function save(this: any) {
      store.set(this.roomId, this);
      return this;
    }),
  }));

  model.findOne = jest.fn(({ roomId }) => ({
    exec: jest.fn().mockResolvedValue(store.get(roomId) ?? null),
  }));
  model.findOneAndUpdate = jest.fn(({ roomId }, update, options) => {
    const current = store.get(roomId) ?? { roomId };
    const next = {
      ...current,
      ...(update.$set ?? {}),
      ...(update.$setOnInsert ?? {}),
    };
    store.set(roomId, next);
    return {
      exec: jest
        .fn()
        .mockResolvedValue(options?.new === false ? current : next),
    };
  });

  return { model, store };
};

const createProfileModel = () => {
  const store = new Map<string, any>();

  const model: any = jest.fn().mockImplementation((data) => ({
    preferences: [],
    brandPreferences: [],
    useCases: [],
    specPreferences: {},
    productsOfInterest: [],
    ...data,
    save: jest.fn().mockImplementation(async function save(this: any) {
      store.set(this.customerId, this);
      return this;
    }),
  }));

  model.findOne = jest.fn(({ customerId }) => ({
    exec: jest.fn().mockResolvedValue(store.get(customerId) ?? null),
  }));
  model.findOneAndUpdate = jest.fn(({ customerId }, update, options) => {
    const current = store.get(customerId) ?? { customerId };
    const next = {
      ...current,
      ...(update.$setOnInsert ?? {}),
      ...(update.$set ?? {}),
    };
    store.set(customerId, next);
    return {
      exec: jest
        .fn()
        .mockResolvedValue(options?.new === false ? current : next),
    };
  });

  return { model, store };
};

describe('AssistantSessionService', () => {
  let sessionModel: any;
  let summarizer: any;
  let service: any;

  beforeEach(() => {
    const setup = createSessionModel();
    sessionModel = setup.model;
    summarizer = {
      summarize: jest.fn().mockResolvedValue({
        need: 'Laptop hoc AI va lap trinh',
        budget: '25 trieu',
        constraints: ['RAM 16GB', 'RTX 4060', 'SSD 1TB'],
        discussedProducts: ['Laptop Alpha', 'Laptop Beta'],
        cartContext: 'Dang can xac nhan them Laptop Alpha vao gio',
        checkoutContext: 'Thieu so dien thoai giao hang',
        orderContext: 'Khach hoi don GVN-1001',
        unresolvedQuestions: ['Uu tien man hinh 144Hz hay trong luong nhe?'],
      }),
    };
    service = new (AssistantSessionService as any)(sessionModel, summarizer);
  });

  it('keeps only the newest 8 hotMessages for a room', async () => {
    for (let index = 1; index <= 10; index += 1) {
      await service.appendHotMessage('room-client-a', {
        role: 'user',
        text: `message-${index}`,
        createdAt: new Date(
          `2026-05-09T00:00:${String(index).padStart(2, '0')}.000Z`,
        ),
      });
    }

    const session = await service.getOrCreateSession('room-client-a');

    expect(session.hotMessages).toHaveLength(8);
    expect(session.hotMessages.map((message) => message.text)).toEqual([
      'message-3',
      'message-4',
      'message-5',
      'message-6',
      'message-7',
      'message-8',
      'message-9',
      'message-10',
    ]);
  });

  it('maintains a progressiveSummary with shopping, cart, checkout, order, and unresolved context', async () => {
    await service.appendHotMessage('room-client-a', {
      role: 'user',
      text: 'Can laptop hoc AI tam 25 trieu, RAM 16GB, RTX 4060, SSD 1TB',
      createdAt: new Date('2026-05-09T00:00:00.000Z'),
    });
    await service.appendHotMessage('room-client-a', {
      role: 'assistant',
      text: 'Laptop Alpha va Laptop Beta dang phu hop.',
      createdAt: new Date('2026-05-09T00:00:01.000Z'),
    });

    const session = await service.getOrCreateSession('room-client-a');

    expect(session.progressiveSummary).toMatchObject({
      need: 'Laptop hoc AI va lap trinh',
      budget: '25 triệu',
      constraints: expect.arrayContaining([
        'RAM 16GB',
        'RTX 4060',
        'SSD 1TB',
        'laptop',
        'học AI/Machine Learning',
        'ưu tiên GPU/RTX',
      ]),
      discussedProducts: ['Laptop Alpha', 'Laptop Beta'],
      cartContext: 'Dang can xac nhan them Laptop Alpha vao gio',
      checkoutContext: 'Thieu so dien thoai giao hang',
      orderContext: 'Khach hoi don GVN-1001',
      unresolvedQuestions: ['Uu tien man hinh 144Hz hay trong luong nhe?'],
    });
    expect(session.progressiveSummary.shoppingNeed).toContain(
      'Can laptop hoc AI tam 25 trieu',
    );
  });

  it('builds prompt context with progressiveSummary and preference notes before recent messages', async () => {
    await service.appendHotMessage('room-client-a', {
      role: 'user',
      text: 'Can uu tien laptop co GPU NVIDIA',
      createdAt: new Date('2026-05-09T00:00:00.000Z'),
    });
    await service.appendHotMessage('room-client-a', {
      role: 'assistant',
      text: 'Da ghi nho uu tien GPU NVIDIA trong phong chat nay.',
      createdAt: new Date('2026-05-09T00:00:01.000Z'),
    });

    const context = await service.buildPromptContext('room-client-a');

    expect(context.threadId).toBe('ai-chat-room-client-a');
    expect(context.sections.map((section) => section.kind)).toEqual([
      'progressiveSummary',
      'preferenceNotes',
      'cartContext',
      'hotMessages',
      'pendingActionDrafts',
    ]);
    expect(context.sections[0].content).toContain('Laptop hoc AI va lap trinh');
    expect(context.sections[3].content).toContain(
      'Can uu tien laptop co GPU NVIDIA',
    );
  });

  it('isolates room sessions, action drafts, and LangGraph thread IDs', async () => {
    await service.setMode('room-client-a', 'ai' as AssistantMode);
    await service.setMode('room-client-b', 'staff' as AssistantMode);
    await service.appendHotMessage('room-client-a', {
      role: 'user',
      text: 'room-client-a needs Laptop Alpha',
      createdAt: new Date('2026-05-09T00:00:00.000Z'),
    });
    await service.appendHotMessage('room-client-b', {
      role: 'user',
      text: 'room-client-b asks about order GVN-2002',
      createdAt: new Date('2026-05-09T00:00:01.000Z'),
    });
    await service.saveActionDraft('room-client-a', {
      draftId: 'draft-cart-a',
      intent: 'CART_ACTION',
      productId: 'product-a',
      quantity: 1,
    });

    const roomA = await service.getOrCreateSession('room-client-a');
    const roomB = await service.getOrCreateSession('room-client-b');
    const promptB = await service.buildPromptContext('room-client-b');
    const consumedA = await service.consumeActionDraft(
      'room-client-a',
      'draft-cart-a',
    );
    const consumedB = await service.consumeActionDraft(
      'room-client-b',
      'draft-cart-a',
    );

    expect(roomA.threadId).toBe('ai-chat-room-client-a');
    expect(roomB.threadId).toBe('ai-chat-room-client-b');
    expect(roomA.threadId).not.toBe(roomB.threadId);
    expect(roomA.hotMessages.map((message) => message.text)).toContain(
      'room-client-a needs Laptop Alpha',
    );
    expect(roomB.hotMessages.map((message) => message.text)).toEqual([
      'room-client-b asks about order GVN-2002',
    ]);
    expect(roomA.pendingActionDrafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ draftId: 'draft-cart-a' }),
      ]),
    );
    expect(roomB.pendingActionDrafts).toEqual([]);
    expect(promptB.threadId).toBe('ai-chat-room-client-b');
    expect(JSON.stringify(promptB)).not.toContain('room-client-a');
    expect(consumedA).toMatchObject({ draftId: 'draft-cart-a' });
    expect(consumedB).toBeNull();
  });

  it('preserves backend-confirmable cart draft fields when saving pending actions', async () => {
    const expiresAt = new Date(Date.now() + 60_000);

    await service.saveActionDraft('room-client-a', {
      draftId: 'draft-cart-confirmable',
      customerId: 'customer-a',
      action: 'CART_ADD',
      kind: 'CART_ADD',
      status: 'pending',
      requiresConfirmation: true,
      displayText: 'Thêm vào giỏ',
      product: {
        id: 'product-a',
        name: 'Laptop Alpha',
        price: 21_990_000,
        stock: 5,
      },
      productId: 'product-a',
      quantity: 1,
      confirmedByBackend: false,
      expiresAt,
      payload: {
        action: 'CART_ADD',
        productId: 'product-a',
        quantity: 1,
      },
    });

    const draft = await service.findPendingActionDraft(
      'room-client-a',
      'draft-cart-confirmable',
    );

    expect(draft).toMatchObject({
      draftId: 'draft-cart-confirmable',
      customerId: 'customer-a',
      action: 'CART_ADD',
      kind: 'CART_ADD',
      status: 'pending',
      requiresConfirmation: true,
      productId: 'product-a',
      quantity: 1,
      payload: expect.objectContaining({
        action: 'CART_ADD',
        productId: 'product-a',
        quantity: 1,
      }),
    });
  });

  it('replaces stale pending action drafts with the newest confirmation draft', async () => {
    await service.saveActionDraft('room-client-a', {
      draftId: 'draft-old',
      customerId: 'customer-a',
      action: 'CART_ADD',
      productId: 'product-old',
      quantity: 1,
      payload: { action: 'CART_ADD', productId: 'product-old', quantity: 1 },
    });
    await service.saveActionDraft('room-client-a', {
      draftId: 'draft-new',
      customerId: 'customer-a',
      action: 'CHECKOUT_REDIRECT',
      checkout: {
        name: 'Nguyen Van A',
        phone: '0909123456',
        address: 'Quan 1, TP HCM',
      },
      redirectPath: '/cart?step=payment',
      payload: { action: 'CHECKOUT_REDIRECT' },
    });

    const stale = await service.findPendingActionDraft('room-client-a', 'draft-old');
    const current = await service.findPendingActionDraft('room-client-a', 'draft-new');

    expect(stale).toBeNull();
    expect(current).toMatchObject({ draftId: 'draft-new' });
  });
  it('stores enriched last recommendation ledger fields and resolves by displayed rank', async () => {
    await service.saveRecommendationLedger('room-client-a', [
      {
        productId: 'product-a',
        name: 'Laptop Alpha',
        slug: 'laptop-alpha',
        price: 25000000,
        discountPrice: 23990000,
        stock: 3,
        specs: { cpu: 'Core Ultra 7', ram: '16GB' },
        searchMetadata: {
          normalizedName: 'laptop alpha',
          specsSummary: 'Core Ultra 7, RAM 16GB',
          categoryPath: ['Laptop'],
        },
      },
      {
        productId: 'product-b',
        name: 'Laptop Beta',
        category: 'Laptop Gaming',
        price: 23000000,
        stock: 5,
      },
    ]);

    const session = await service.getOrCreateSession('room-client-a');
    const second = await service.resolveRecommendationReference(
      'room-client-a',
      'cái thứ 2',
    );
    const missing = await service.resolveRecommendationReference(
      'room-client-a',
      'cái thứ 9',
    );

    expect(session.lastRecommendationLedger).toEqual([
      expect.objectContaining({
        rank: 1,
        productId: 'product-a',
        name: 'Laptop Alpha',
        slug: 'laptop-alpha',
        normalizedName: 'laptop alpha',
        category: 'Laptop',
        price: 25000000,
        discountPrice: 23990000,
        stock: 3,
        specsSummary: 'Core Ultra 7, RAM 16GB',
      }),
      expect.objectContaining({
        rank: 2,
        productId: 'product-b',
        name: 'Laptop Beta',
        category: 'Laptop Gaming',
      }),
    ]);
    expect(second).toMatchObject({ rank: 2, productId: 'product-b' });
    expect(missing).toBeNull();
  });

  it('returns only the current room recommendation ledger and tolerates stale optional fields', async () => {
    await service.saveRecommendationLedger('room-client-a', [
      {
        productId: 'product-a',
        name: 'Laptop Alpha',
        price: 25000000,
        stock: 3,
      },
    ]);
    await service.saveRecommendationLedger('room-client-b', [
      {
        productId: 'product-b',
        name: 'Laptop Beta',
        slug: 'laptop-beta',
        category: 'Laptop',
        discountPrice: 21990000,
        stock: 5,
      },
    ]);

    await expect(service.getLastRecommendationLedger('room-client-a')).resolves.toEqual([
      expect.objectContaining({
        rank: 1,
        productId: 'product-a',
        name: 'Laptop Alpha',
        slug: undefined,
        normalizedName: 'laptop alpha',
      }),
    ]);
    await expect(service.getLastRecommendationLedger('missing-room')).resolves.toEqual([]);
  });

  it('uses the assistant session schema contract for room-scoped memory fields', () => {
    const session: Partial<AssistantSession> = {
      roomId: 'room-client-a',
      threadId: 'ai-chat-room-client-a',
      mode: 'ai' as AssistantMode,
      hotMessages: [],
      progressiveSummary: {
        shoppingNeed: '',
        budget: '',
        constraintsAndSpecs: [],
        productsDiscussed: [],
        cartCheckoutContext: '',
        orderContext: '',
        unresolvedQuestions: [],
      },
      pendingActionDrafts: [],
      lastRecommendationLedger: [],
    };

    expect(session).toMatchObject({
      roomId: 'room-client-a',
      threadId: 'ai-chat-room-client-a',
      hotMessages: [],
      progressiveSummary: {
        shoppingNeed: '',
        budget: '',
        constraintsAndSpecs: [],
        productsDiscussed: [],
        cartCheckoutContext: '',
        orderContext: '',
        unresolvedQuestions: [],
      },
      pendingActionDrafts: [],
      lastRecommendationLedger: [],
    });
  });
});

describe('CustomerAssistantProfileService', () => {
  let service: CustomerAssistantProfileService;
  let profileModel: any;

  beforeEach(() => {
    const setup = createProfileModel();
    profileModel = setup.model;
    service = new CustomerAssistantProfileService(profileModel);
  });

  it('merges owner-isolated memory with latest explicit contact values winning', async () => {
    await service.mergeExtractedMemory('customer-a', {
      preferences: ['laptop AI'],
      budgetRange: '25 triệu',
      phone: '0901234567',
      address: '123 Nguyễn Trãi, Quận 1, TP HCM',
    });
    await service.mergeExtractedMemory('customer-a', {
      preferences: ['RTX 4060'],
      phone: '0919999888',
      specPreferences: { ram: '32GB' },
    });
    await service.mergeExtractedMemory('customer-b', {
      preferences: ['màn hình 27 inch'],
      phone: '0988888777',
    });

    const customerA = await profileModel
      .findOne({
        customerId: 'customer-a',
      })
      .exec();
    const customerBPrompt =
      await service.buildRedactedPromptSection('customer-b');

    expect(customerA).toMatchObject({
      customerId: 'customer-a',
      preferences: ['laptop AI', 'RTX 4060'],
      budgetRange: '25 triệu',
      phone: '0919999888',
      address: '123 Nguyễn Trãi, Quận 1, TP HCM',
      specPreferences: { ram: '32GB' },
    });
    expect(JSON.stringify(customerA)).not.toContain('0988888777');
    expect(customerBPrompt).toContain('098****777');
    expect(customerBPrompt).not.toContain('0919999888');
  });

  it('builds redacted prompt profile without exposing raw phone or long address', async () => {
    await service.mergeExtractedMemory('customer-a', {
      name: 'Nguyễn Văn A',
      phone: '0901234567',
      address: '123 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP HCM',
      brandPreferences: ['Lenovo'],
      useCases: ['học AI'],
      productsOfInterest: ['Laptop Alpha'],
    });

    const prompt = await service.buildRedactedPromptSection('customer-a');

    expect(prompt).toContain('Nguyễn Văn A');
    expect(prompt).toContain('090****567');
    expect(prompt).toContain('Lenovo');
    expect(prompt).toContain('học AI');
    expect(prompt).toContain('Laptop Alpha');
    expect(prompt).not.toContain('0901234567');
    expect(prompt).not.toContain('Phường Bến Thành');
  });

  it('creates a unique owner-scoped assistant profile index', () => {
    expect(CustomerAssistantProfileSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ customerId: 1 }, expect.objectContaining({ unique: true })],
      ]),
    );
  });
});

describe('assistant foundation contracts', () => {
  it('exports the assistant mode and intent contracts', () => {
    const mode: AssistantMode = 'ai';
    const staffMode: AssistantMode = 'staff';
    const intent: AssistantIntent = 'PRODUCT_ADVICE';
    const unsupportedIntent: AssistantIntent = 'UNSUPPORTED';

    expect([mode, staffMode]).toEqual(['ai', 'staff']);
    expect([intent, unsupportedIntent]).toEqual([
      'PRODUCT_ADVICE',
      'UNSUPPORTED',
    ]);
  });

  it('exports action draft and assistant message metadata shapes', () => {
    const draft: AssistantActionDraft = {
      draftId: 'draft-1',
      roomId: 'room-1',
      customerId: 'customer-1',
      kind: 'CART_ADD',
      displayText: 'Add Laptop Alpha to cart',
      payload: { productId: 'product-1', quantity: 1 },
      requiresConfirmation: true,
      createdAt: new Date('2026-05-09T00:00:00.000Z'),
      expiresAt: new Date('2026-05-09T00:05:00.000Z'),
    };
    const metadata: AssistantMessageMetadata = {
      kind: 'assistant',
      mode: 'ai',
      productCards: [],
      reviewSummary: null,
      orderCards: [],
      actionDrafts: [draft],
      handoff: null,
      unsupportedReason: null,
      traceId: 'trace-1',
    };

    expect(metadata.actionDrafts[0]).toMatchObject({
      draftId: 'draft-1',
      roomId: 'room-1',
      requiresConfirmation: true,
    });
  });

  it('exports a LangGraph shopping assistant state root', () => {
    expect(ShoppingAssistantState.spec.intents).toBeDefined();
    expect(ShoppingAssistantState.spec.responses).toBeDefined();
    expect(ShoppingAssistantState.spec.actionDrafts).toBeDefined();
    expect(ShoppingAssistantState.spec.errors).toBeDefined();
    expect(ShoppingAssistantState.spec.traceEvents).toBeDefined();
    expect(ShoppingAssistantState.spec.supervisorDecision).toBeDefined();
    expect(ShoppingAssistantState.spec.activeSubgraph).toBeDefined();
    expect(ShoppingAssistantState.spec.toolResults).toBeDefined();
    expect(ShoppingAssistantState.spec.memoryReferences).toBeDefined();
    expect(ShoppingAssistantState.spec.guardrailDecisions).toBeDefined();
    expect(ShoppingAssistantState.spec.responseMerge).toBeDefined();
    expect(ShoppingAssistantState.spec.lastRecommendationLedger).toBeDefined();
  });

  it('creates a unique room-scoped assistant session index', () => {
    expect(AssistantSessionSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ roomId: 1 }, expect.objectContaining({ unique: true })],
      ]),
    );
  });

  it('wires assistant module through the AI module without a public controller', () => {
    const metadata = Reflect.getMetadata('imports', AiModule) as unknown[];
    const exportsMetadata = Reflect.getMetadata(
      'exports',
      AiModule,
    ) as unknown[];

    expect(
      metadata.some((item) => String(item).includes('AiAssistantModule')),
    ).toBe(true);
    expect(
      exportsMetadata.some((item) =>
        String(item).includes('AiAssistantModule'),
      ),
    ).toBe(true);
  });

  it('registers and exports customer assistant profile memory contracts', () => {
    const importsMetadata = Reflect.getMetadata(
      'imports',
      AiAssistantModule,
    ) as unknown[];
    const providersMetadata = Reflect.getMetadata(
      'providers',
      AiAssistantModule,
    ) as unknown[];
    const exportsMetadata = Reflect.getMetadata(
      'exports',
      AiAssistantModule,
    ) as unknown[];

    expect(JSON.stringify(importsMetadata)).toContain(
      CustomerAssistantProfile.name,
    );
    expect(providersMetadata).toContain(CustomerAssistantProfileService);
    expect(exportsMetadata).toContain(CustomerAssistantProfileService);
  });
});

describe('assistant model config and trace redaction', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('reads backend-only OpenRouter chat model config with strict parameter defaults', () => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    delete process.env.OPENROUTER_CHAT_MODEL;

    const config = readAssistantModelConfig();

    expect(config.openRouter.apiKeyPresent).toBe(true);
    expect(config.openRouter.chatModel).toBe('deepseek-v4-pro');
    expect(config.openRouter.temperature).toBe(0.1);
    expect(config.openRouter.maxTokens).toBe(2200);
    expect(config.openRouter.provider).toMatchObject({
      require_parameters: true,
    });
    expect(JSON.stringify(config)).not.toContain('test-openrouter-key');
  });

  it('allows bounded OpenRouter chat token override for longer grounded answers', () => {
    process.env.OPENROUTER_CHAT_MAX_TOKENS = '2400';

    expect(readAssistantModelConfig().openRouter.maxTokens).toBe(2400);

    process.env.OPENROUTER_CHAT_MAX_TOKENS = '999999';
    expect(readAssistantModelConfig().openRouter.maxTokens).toBe(4000);

    process.env.OPENROUTER_CHAT_MAX_TOKENS = '100';
    expect(readAssistantModelConfig().openRouter.maxTokens).toBe(2200);
  });

  it('checks structured-output and review-search capabilities before live model use', () => {
    expect(() =>
      assertAssistantModelCapabilities({
        supportsStructuredOutputs: true,
        supportsReviewSearch: true,
      }),
    ).not.toThrow();

    expect(() =>
      assertAssistantModelCapabilities({
        supportsStructuredOutputs: false,
        supportsReviewSearch: true,
      }),
    ).toThrow('strict structured outputs');
  });

  it('redacts PII and staff-only text while preserving trace dimensions', () => {
    const service = new AssistantTraceService();

    const redacted = service.redactTraceMetadata({
      traceId: 'trace-1',
      roomId: 'room-client-a',
      node: 'product_advice',
      intent: 'PRODUCT_ADVICE',
      latencyMs: 125,
      tokenCount: 321,
      model: 'openai/gpt-4o-mini',
      errorCode: 'MODEL_TIMEOUT',
      safety: { piiRedacted: true, staffOnly: true },
      phone: '0901234567',
      address: '123 Nguyen Trai, Quan 1',
      orderDetailText: 'Don hang GVN-1001 giao den nha rieng',
      staffSummary: 'Khach dang can tu van noi bo',
      messageText: 'So dien thoai cua toi la 0901234567',
    });

    expect(redacted).toMatchObject({
      traceId: 'trace-1',
      roomId: 'room-client-a',
      node: 'product_advice',
      intent: 'PRODUCT_ADVICE',
      latencyMs: 125,
      tokenCount: 321,
      model: 'openai/gpt-4o-mini',
      errorCode: 'MODEL_TIMEOUT',
      safety: { piiRedacted: true, staffOnly: true },
    });
    expect(JSON.stringify(redacted)).not.toContain('0901234567');
    expect(JSON.stringify(redacted)).not.toContain('Nguyen Trai');
    expect(JSON.stringify(redacted)).not.toContain('GVN-1001 giao den');
    expect(JSON.stringify(redacted)).not.toContain('tu van noi bo');
  });
});
