import {
  StaffHandoffSummaryService,
  staffHandoffNode,
  SupportHandoffAdapter,
} from './staff-handoff.node';

describe('staffHandoffNode', () => {
  const roomId = 'room-client-customer-1';
  const customerId = 'customer-1';

  const context = {
    roomId,
    customerId,
    latestMessage: 'Chat với nhân viên tư vấn',
    intent: 'STAFF_HANDOFF',
    memory: {
      need: 'Laptop gaming kiêm đồ họa',
      budget: '25 triệu',
      constraints: ['RTX 4060', 'màn 144Hz', 'ưu tiên bảo hành tốt'],
      productsDiscussed: [
        { id: 'product-1', name: 'Laptop Gaming A' },
        { id: 'product-2', name: 'Laptop Creator B' },
      ],
      cartContext: ['đã hỏi thêm Laptop Gaming A vào giỏ'],
      checkoutContext: ['cần xác nhận địa chỉ giao hàng'],
      orderContext: ['không có đơn đang hỏi'],
      unresolvedQuestions: ['có nâng RAM tại cửa hàng không'],
      confidence: 'medium',
      uncertainty: 'chưa xác minh tồn kho chi nhánh',
    },
  };

  const makeAdapter = (): jest.Mocked<SupportHandoffAdapter> =>
    ({
      setMode: jest.fn().mockResolvedValue({ mode: 'staff', aiPaused: true }),
      createOrRefreshForChat: jest.fn().mockResolvedValue({
        id: 'ticket-1',
        sourceType: 'chat',
        roomId,
        status: 'new',
      }),
      appendStaffOnlyMetadata: jest.fn().mockResolvedValue(undefined),
      serializeCustomerPayload: jest.fn((message) => {
        const { assistantHandoffSummary: _summary, ...metadata } =
          message.metadata ?? {};
        return {
          ...message,
          metadata,
        };
      }),
    }) as any;

  it('does not auto-transfer routine product advice to staff', async () => {
    const adapter = makeAdapter();

    const result = await staffHandoffNode(
      {
        ...context,
        latestMessage: 'Tư vấn laptop gaming dưới 25 triệu',
        intent: 'PRODUCT_ADVICE',
      },
      adapter,
    );

    expect(result).toMatchObject({
      type: 'continue_ai',
      mode: 'ai',
    });
    expect(adapter.setMode).not.toHaveBeenCalled();
    expect(adapter.createOrRefreshForChat).not.toHaveBeenCalled();
    expect(adapter.appendStaffOnlyMetadata).not.toHaveBeenCalled();
  });

  it.each(['STAFF_HANDOFF', 'Chat với nhân viên tư vấn'])(
    'switches to staff mode only for explicit handoff trigger %s',
    async (trigger) => {
      const adapter = makeAdapter();

      const result = await staffHandoffNode(
        {
          ...context,
          intent: trigger === 'STAFF_HANDOFF' ? 'STAFF_HANDOFF' : 'GENERAL_CHAT',
          latestMessage: trigger,
        },
        adapter,
      );

      expect(adapter.setMode).toHaveBeenCalledWith(roomId, {
        mode: 'staff',
        aiPaused: true,
      });
      expect(adapter.createOrRefreshForChat).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'chat',
          roomId,
          customerId,
          contextLabel: 'Chat với nhân viên tư vấn',
          metadata: {
            assistantHandoffSummary: expect.objectContaining({
              staffOnly: true,
              transcriptRoomId: roomId,
            }),
          },
        }),
      );
      expect(adapter.appendStaffOnlyMetadata).toHaveBeenCalledWith(
        roomId,
        expect.objectContaining({
          assistantHandoffSummary: expect.objectContaining({
            staffOnly: true,
            need: context.memory.need,
            budget: context.memory.budget,
            constraints: context.memory.constraints,
            productsDiscussed: context.memory.productsDiscussed,
            cartContext: context.memory.cartContext,
            checkoutContext: context.memory.checkoutContext,
            orderContext: context.memory.orderContext,
            unresolvedQuestions: context.memory.unresolvedQuestions,
            confidence: context.memory.confidence,
            uncertainty: context.memory.uncertainty,
          }),
        }),
      );
      expect(result).toMatchObject({
        type: 'staff_handoff',
        mode: 'staff',
        aiPaused: true,
        ticket: {
          sourceType: 'chat',
          roomId,
        },
        staffMetadata: {
          assistantHandoffSummary: {
            staffOnly: true,
          },
        },
      });
    },
  );

  it('omits assistantHandoffSummary from customer-visible payloads', async () => {
    const adapter = makeAdapter();
    const result = await staffHandoffNode(context, adapter);

    const customerPayload = adapter.serializeCustomerPayload({
      id: 'message-1',
      roomId,
      text: 'Đã chuyển sang nhân viên tư vấn.',
      metadata: {
        assistantHandoffSummary: result.staffMetadata.assistantHandoffSummary,
        publicAction: 'handoff_started',
      },
    });

    expect(result.staffMetadata.assistantHandoffSummary).toMatchObject({
      staffOnly: true,
    });
    expect(customerPayload.metadata).toEqual({
      publicAction: 'handoff_started',
    });
    expect(customerPayload.metadata).not.toHaveProperty('assistantHandoffSummary');
  });
});

describe('StaffHandoffSummaryService', () => {
  it('builds a staff-only consultation brief with commerce and uncertainty context', () => {
    const service = new StaffHandoffSummaryService();

    const summary = service.build({
      need: 'Laptop gaming kiêm đồ họa',
      budget: '25 triệu',
      constraints: ['RTX 4060', 'màn 144Hz'],
      productsDiscussed: ['Laptop Gaming A'],
      cartContext: ['muốn thêm Laptop Gaming A'],
      checkoutContext: ['thiếu số điện thoại'],
      orderContext: ['không hỏi đơn hàng'],
      unresolvedQuestions: ['nâng RAM tại cửa hàng'],
      confidence: 'medium',
      uncertainty: 'chưa xác minh tồn kho chi nhánh',
    });

    expect(summary).toMatchObject({
      staffOnly: true,
      need: 'Laptop gaming kiêm đồ họa',
      budget: '25 triệu',
      constraints: ['RTX 4060', 'màn 144Hz'],
      productsDiscussed: ['Laptop Gaming A'],
      cartContext: ['muốn thêm Laptop Gaming A'],
      checkoutContext: ['thiếu số điện thoại'],
      orderContext: ['không hỏi đơn hàng'],
      unresolvedQuestions: ['nâng RAM tại cửa hàng'],
      confidence: 'medium',
      uncertainty: 'chưa xác minh tồn kho chi nhánh',
    });
  });
});
