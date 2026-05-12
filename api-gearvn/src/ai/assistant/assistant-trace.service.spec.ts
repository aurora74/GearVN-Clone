import { AssistantTraceService } from './assistant-trace.service';
import {
  createAssistantTracer,
  recordAssistantSpan,
} from './tracing/ai-tracing';

describe('AssistantTraceService', () => {
  it('redactTraceMetadata keeps deterministic trace dimensions and boolean safety flags', () => {
    const service = new AssistantTraceService();

    const redacted = service.redactTraceMetadata({
      traceId: 'trace-1',
      roomId: 'room-client-a',
      node: 'checkout_prep',
      intent: 'CHECKOUT_PREP',
      latencyMs: 142,
      tokenCount: 311,
      model: 'openai/gpt-4o-mini',
      errorCode: 'VOUCHER_RECHECK_REQUIRED',
      safety: {
        piiRedacted: true,
        guardrailBlocked: false,
        unsafeValue: 'not-boolean' as unknown as boolean,
      },
      phone: '0901234567',
    });

    expect(redacted).toEqual({
      traceId: 'trace-1',
      roomId: 'room-client-a',
      node: 'checkout_prep',
      intent: 'CHECKOUT_PREP',
      latencyMs: 142,
      tokenCount: 311,
      model: 'openai/gpt-4o-mini',
      errorCode: 'VOUCHER_RECHECK_REQUIRED',
      safety: {
        piiRedacted: true,
        guardrailBlocked: false,
      },
    });
  });

  it('redactTraceMetadata allows agent snake_case observability fields', () => {
    const service = new AssistantTraceService();

    const redacted = service.redactTraceMetadata({
      traceId: 'trace-agent-1',
      supervisor_decision: {
        route: 'sales',
        confidence: 0.91,
        intents: ['PRODUCT_ADVICE'],
      },
      active_subgraph: 'sales',
      tool_calls: [
        {
          toolName: 'search_products',
          subgraph: 'sales',
          status: 'success',
          latencyMs: 88,
          outputSummary: '3 candidates',
        },
      ],
      retrieval_query: 'laptop AI RTX 4060',
      crag_retry: { attempted: true, reason: 'low_candidate_count' },
      memory_used: [
        {
          kind: 'preference',
          label: 'GPU NVIDIA',
          redactedValue: 'GPU NVIDIA',
        },
      ],
      response_merge: {
        strategy: 'merge',
        sourceSubgraphs: ['sales'],
        preservedMetadata: ['productCards'],
      },
      guardrail_decision: {
        rule: 'checkout-authority',
        action: 'allow',
      },
      model_name: 'openai/gpt-4o-mini',
      latency_ms: 233,
      fallback_reason: 'none',
      phone: '0901234567',
      address: '123 Nguyen Trai',
      userMessageText: 'toi can laptop AI giao den 123 Nguyen Trai',
    });

    expect(redacted).toMatchObject({
      traceId: 'trace-agent-1',
      supervisor_decision: {
        route: 'sales',
        confidence: 0.91,
        intents: ['PRODUCT_ADVICE'],
      },
      active_subgraph: 'sales',
      tool_calls: [
        expect.objectContaining({
          toolName: 'search_products',
          status: 'success',
        }),
      ],
      retrieval_query: 'laptop AI RTX 4060',
      crag_retry: { attempted: true, reason: 'low_candidate_count' },
      response_merge: {
        strategy: 'merge',
        sourceSubgraphs: ['sales'],
        preservedMetadata: ['productCards'],
      },
      guardrail_decision: {
        rule: 'checkout-authority',
        action: 'allow',
      },
      model_name: 'openai/gpt-4o-mini',
      latency_ms: 233,
      fallback_reason: 'none',
    });
    expect(JSON.stringify(redacted)).not.toContain('0901234567');
    expect(JSON.stringify(redacted)).not.toContain('Nguyen Trai');
    expect(JSON.stringify(redacted)).not.toContain('toi can laptop');
  });

  it('allows 09.2 latency fields while stripping raw messages, public-source text, phone/address-like values, and secrets', () => {
    const service = new AssistantTraceService();
    const rawPublicSourceText =
      'Full public-source text says this laptop is the best and includes noisy unsupported claims.';

    const redacted = service.redactTraceMetadata({
      traceId: 'trace-hotfix-latency',
      node: 'product_context_resolver',
      supervisor_latency_ms: 11,
      deterministic_bypass: true,
      bypass_confidence: 0.94,
      resolver_latency_ms: 7,
      product_context_resolver: {
        matchSource: 'ledger.rank',
        productId: 'p1',
      },
      catalog_detail_latency_ms: 13,
      web_review_latency_ms: 0,
      memory_extraction_latency_ms: 0,
      memory_extraction_scheduled: true,
      memory_extraction_mode: 'best_effort_async',
      retrieval_latency_ms: 88,
      response_composition_latency_ms: 24,
      rawMessage: 'Số điện thoại 0901234567, giao đến 123 Nguyễn Trãi',
      phone: '0901234567',
      address: '123 Nguyễn Trãi, Quận 1',
      fullPublicSourceText: rawPublicSourceText,
      publicSourceText: rawPublicSourceText,
      secret: 'OPENROUTER_API_KEY=sk-test-secret',
      apiKey: 'sk-test-secret',
    });

    expect(redacted).toMatchObject({
      supervisor_latency_ms: 11,
      deterministic_bypass: true,
      bypass_confidence: 0.94,
      resolver_latency_ms: 7,
      product_context_resolver: {
        matchSource: 'ledger.rank',
        productId: 'p1',
      },
      catalog_detail_latency_ms: 13,
      web_review_latency_ms: 0,
      memory_extraction_latency_ms: 0,
      memory_extraction_scheduled: true,
      memory_extraction_mode: 'best_effort_async',
      retrieval_latency_ms: 88,
      response_composition_latency_ms: 24,
    });
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain('Số điện thoại');
    expect(serialized).not.toContain('0901234567');
    expect(serialized).not.toContain('Nguyễn Trãi');
    expect(serialized).not.toContain(rawPublicSourceText);
    expect(serialized).not.toContain('sk-test-secret');
    expect(serialized).not.toContain('OPENROUTER_API_KEY');
  });

  it('redactTraceMetadata omits raw phone, address, order detail, staff summary, and full user message values', () => {
    const service = new AssistantTraceService();
    const rawPhone = '0901234567';
    const rawAddress = '123 Nguyen Trai, Quan 1, TP HCM';
    const rawOrderDetail = 'Don GVN-1001 giao den nha rieng, tong 25000000';
    const rawStaffSummary = 'Khach can uu tien hang loi nhuan cao noi bo';
    const rawMessage = 'So dien thoai cua toi la 0901234567, giao den 123 Nguyen Trai';

    const redacted = service.redactTraceMetadata({
      traceId: 'trace-2',
      roomId: 'room-client-b',
      node: 'order_lookup',
      intent: 'ORDER_LOOKUP',
      phone: rawPhone,
      address: rawAddress,
      orderDetailText: rawOrderDetail,
      orderDetail: rawOrderDetail,
      staffSummaryText: rawStaffSummary,
      staffSummary: rawStaffSummary,
      userMessageText: rawMessage,
      fullUserMessageText: rawMessage,
      rawMessage,
    });
    const serialized = JSON.stringify(redacted);

    expect(serialized).not.toContain(rawPhone);
    expect(serialized).not.toContain(rawAddress);
    expect(serialized).not.toContain(rawOrderDetail);
    expect(serialized).not.toContain(rawStaffSummary);
    expect(serialized).not.toContain(rawMessage);
  });

  it('records Phoenix/OpenTelemetry-compatible span attributes only after redaction with hashed identifiers', async () => {
    const spanSink = jest.fn();
    const tracer = createAssistantTracer({ enabled: true, spanSink });

    await recordAssistantSpan(tracer, 'assistant.checkout_prep', {
      traceId: 'trace-3',
      roomId: 'room-client-c',
      userId: 'customer-42',
      node: 'checkout_prep',
      intent: 'CHECKOUT_PREP',
      mode: 'ai',
      nodePath: ['classify_intent', 'checkout_prep', 'merge_response'],
      model: 'openai/gpt-4o-mini',
      latencyMs: 215,
      tokenCount: 501,
      productIds: ['product-1'],
      sourceUrls: ['https://example.test/review'],
      actionDraftIds: ['draft-1'],
      confirmationResult: 'pending',
      guardrailDecisions: ['checkout_redirect_only'],
      retryCount: 1,
      errorCount: 0,
      safety: { piiRedacted: true },
      phone: '0901234567',
      address: '123 Nguyen Trai',
      userMessageText: 'Thanh toan giup toi bang so 0901234567',
    });

    expect(spanSink).toHaveBeenCalledWith(
      'assistant.checkout_prep',
      expect.objectContaining({
        'ai.trace_id': 'trace-3',
        'ai.room_id_hash': expect.any(String),
        'ai.user_id_hash': expect.any(String),
        'ai.mode': 'ai',
        'ai.intent': 'CHECKOUT_PREP',
        'ai.node': 'checkout_prep',
        'ai.node_path': 'classify_intent>checkout_prep>merge_response',
        'ai.model': 'openai/gpt-4o-mini',
        'ai.latency_ms': 215,
        'ai.token_count': 501,
        'ai.product_ids': 'product-1',
        'ai.source_urls': 'https://example.test/review',
        'ai.action_draft_ids': 'draft-1',
        'ai.confirmation_result': 'pending',
        'ai.guardrail_decisions': 'checkout_redirect_only',
        'ai.retry_count': 1,
        'ai.error_count': 0,
        'ai.safety.piiRedacted': true,
      }),
    );

    const attributes = JSON.stringify(spanSink.mock.calls[0][1]);
    expect(attributes).not.toContain('room-client-c');
    expect(attributes).not.toContain('customer-42');
    expect(attributes).not.toContain('0901234567');
    expect(attributes).not.toContain('Nguyen Trai');
    expect(attributes).not.toContain('Thanh toan giup toi');
  });

  it('keeps Phoenix, LangSmith, and promptfoo observability optional for acceptance', () => {
    const tracer = createAssistantTracer({ enabled: false });

    expect(tracer.enabled).toBe(false);
    expect(tracer.packageName).toBe('@arizeai/phoenix-otel');
    expect(tracer.optionalDependencies).toEqual(
      expect.arrayContaining(['langsmith', 'promptfoo']),
    );
    expect(tracer.requiredDependencies).not.toEqual(
      expect.arrayContaining(['langsmith', 'promptfoo']),
    );
  });
});
