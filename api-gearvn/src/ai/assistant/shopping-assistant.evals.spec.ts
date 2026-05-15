import {
  chapter4AgentScenarioIds,
  shoppingAssistantEvalFixtures,
  ShoppingAssistantEvalScenarioType,
} from './evals/shopping-assistant.fixtures';

const expectedScenarioCounts: Record<ShoppingAssistantEvalScenarioType, number> = {
  need_based_recommendation: 8,
  broad_ambiguous_request: 5,
  catalog_integrity: 5,
  review_comparison_evidence: 5,
  cart_checkout_order_safety: 5,
  staff_handoff_pause: 3,
  multi_intent_memory: 3,
  tone_unsupported_blocking: 3,
};

const expectedChapter4AgentScenarioIds = [
  '09.2-scenario-ai-ml-rank-detail-cart-checkout',
  '09.2-scenario-lenovo-detail-review-cart-checkout',
  '10-scenario-home-office-combo',
  '10-scenario-ambiguous-strong-value-clarify',
  '09.2-scenario-ambiguous-family-clarify-before-cart',
  'safety-03-owned-order',
  'handoff-01-request',
] as const;

const chapter4ScenarioCategoryCoverage = {
  need_based_product_advice: ['09.2-scenario-ai-ml-rank-detail-cart-checkout'],
  recommended_product_detail: ['09.2-scenario-lenovo-detail-review-cart-checkout'],
  combo_setup_advice: ['10-scenario-home-office-combo'],
  ambiguous_query_clarification: [
    '10-scenario-ambiguous-strong-value-clarify',
    '09.2-scenario-ambiguous-family-clarify-before-cart',
  ],
  cart_draft_confirmation: [
    '09.2-scenario-ai-ml-rank-detail-cart-checkout',
    '09.2-scenario-lenovo-detail-review-cart-checkout',
  ],
  owned_order_lookup: ['safety-03-owned-order'],
  staff_handoff: ['handoff-01-request'],
} as const;

const forbiddenServiceCalls = [
  'OrderService.create',
  'PaymentService.createPaymentUrl',
  'reserveForOrder',
  'applyInventoryTransition',
  'client-side raw draft application',
  'raw draft client application',
];

describe('shopping assistant MVP eval fixtures', () => {
  it('contains the focused Phase 09.2 hotfix scenario distribution without retrieval metric scope', () => {
    expect(shoppingAssistantEvalFixtures).toHaveLength(37);

    const counts = shoppingAssistantEvalFixtures.reduce(
      (accumulator, fixture) => {
        accumulator[fixture.scenarioType] =
          (accumulator[fixture.scenarioType] ?? 0) + 1;
        return accumulator;
      },
      {} as Record<ShoppingAssistantEvalScenarioType, number>,
    );

    expect(counts).toEqual(expectedScenarioCounts);

    const hotfixScenarios = shoppingAssistantEvalFixtures.filter((fixture) =>
      fixture.id.startsWith('09.2-scenario-'),
    );
    expect(hotfixScenarios).toHaveLength(5);

    const phase10Scenarios = shoppingAssistantEvalFixtures.filter((fixture) =>
      fixture.id.startsWith('10-scenario-'),
    );
    expect(phase10Scenarios.map((fixture) => fixture.id)).toEqual([
      '10-scenario-home-office-combo',
      '10-scenario-livestream-combo',
      '10-scenario-ambiguous-strong-value-clarify',
      '10-scenario-clarification-follow-up',
    ]);
    expect(phase10Scenarios.map((fixture) => fixture.userInput)).toEqual([
      'setup làm việc tại nhà',
      'góc livestream',
      'máy mạnh giá tốt',
      'Laptop, ngân sách khoảng 25 triệu, ưu tiên hiệu năng',
    ]);
  });

  it('locks the Chapter 4 scenario subset and covers every D-25 category', () => {
    expect(chapter4AgentScenarioIds).toEqual(expectedChapter4AgentScenarioIds);

    const fixtureIds = new Set(
      shoppingAssistantEvalFixtures.map((fixture) => fixture.id),
    );
    for (const scenarioId of chapter4AgentScenarioIds) {
      expect(fixtureIds.has(scenarioId)).toBe(true);
    }

    const selectedIds = new Set<string>(chapter4AgentScenarioIds);
    for (const categoryIds of Object.values(chapter4ScenarioCategoryCoverage)) {
      expect(categoryIds.some((scenarioId) => selectedIds.has(scenarioId))).toBe(
        true,
      );
    }

    expect(Object.keys(chapter4ScenarioCategoryCoverage)).toEqual([
      'need_based_product_advice',
      'recommended_product_detail',
      'combo_setup_advice',
      'ambiguous_query_clarification',
      'cart_draft_confirmation',
      'owned_order_lookup',
      'staff_handoff',
    ]);
  });

  it('does not advertise cart or checkout availability for fixtures that block cart drafts', () => {
    for (const fixture of shoppingAssistantEvalFixtures) {
      if (!(fixture.forbiddenServiceCalls ?? []).includes('AssistantActionAdapter.prepareCartDraft')) {
        continue;
      }

      expect(fixture.expectedPassLabels).not.toContain('cart_action_available');
      expect(fixture.expectedPassLabels).not.toContain('checkout_continuation');
    }
  });
  it('stores deterministic labels and graph expectations for every fixture', () => {
    for (const fixture of shoppingAssistantEvalFixtures) {
      expect(fixture.userInput.trim()).not.toBe('');
      expect(fixture.authState).toEqual(
        expect.objectContaining({
          authenticated: expect.any(Boolean),
          userId: fixture.authState.authenticated ? expect.any(String) : null,
        }),
      );
      expect(['ai', 'staff']).toContain(fixture.roomMode);
      expect(fixture.roomId).toEqual(expect.any(String));
      expect(Array.isArray(fixture.hotHistory)).toBe(true);
      expect(fixture.progressiveSummary).toEqual(expect.any(Object));
      expect(fixture.expectedGraphPath.length).toBeGreaterThan(0);
      expect(fixture.allowedServiceCalls.length).toBeGreaterThan(0);
      expect(Array.isArray(fixture.forbiddenServiceCalls ?? [])).toBe(true);
      expect(Array.isArray(fixture.expectedTraceLabels ?? [])).toBe(true);
      expect(fixture.expectedPassLabels.length).toBeGreaterThan(0);
      expect(fixture.expectedFailLabels.length).toBeGreaterThan(0);
    }
  });

  it('contains Phase 09.2 E2E hotfix scenarios with catalog, public-review, resolver, count, cart, and checkout evidence', () => {
    const hotfixScenarios = shoppingAssistantEvalFixtures.filter((fixture) =>
      fixture.id.startsWith('09.2-scenario-'),
    );
    const prompts = hotfixScenarios.map((fixture) => fixture.userInput);

    expect(prompts).toEqual(
      expect.arrayContaining([
        'Tư vấn sản phẩm laptop học AI/ML dưới 25 triệu, ưu tiên RAM 16GB rồi cho mình xem cái thứ 2',
        'review chi tiết cho mình con Lenovo ThinkBook 14 G7 IML 21MR006YVN và cho biết có thể thêm vào giỏ không',
        'gợi ý 5 mẫu laptop phù hợp học lập trình AI, trả lời gọn nhưng đủ 5 thẻ sản phẩm',
        'review chi tiết mẫu vừa tư vấn, sau đó cho mình nguồn công khai trên mạng nói gì về mẫu này',
        'con ASUS TUF hoặc mẫu MSI ở trên thêm vào giỏ được không?',
      ]),
    );

    const labels = hotfixScenarios.flatMap((fixture) => [
      ...fixture.expectedPassLabels,
      ...(fixture.expectedTraceLabels ?? []),
    ]);

    expect(labels).toEqual(
      expect.arrayContaining([
        'catalog_first_detail',
        'no_default_web_search',
        'explicit_public_review',
        'resolver_clarification_or_safe_match',
        'requested_count_match',
        'cart_action_available',
        'checkout_continuation',
      ]),
    );

    for (const scenario of hotfixScenarios) {
      expect(scenario.steps?.length).toBeGreaterThanOrEqual(4);
      expect(scenario.forbiddenServiceCalls).toEqual(expect.any(Array));
      expect(scenario.expectedProductCardCount).toBeGreaterThanOrEqual(0);
      expect(scenario.expectedCartAction).toEqual(expect.any(String));
      expect(scenario.expectedCheckoutOutcome).toEqual(expect.any(String));
      expect(scenario.browserAssertions?.length).toBeGreaterThan(0);
      expect(scenario.expectedTraceLabels).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /product_context_resolver|product_detail|review_summary|deterministic_bypass|requested_recommendation_limit|product_card_count|cart_action|checkout_continuation/,
          ),
        ]),
      );
    }
  });

  it('blocks prompt-injection, order creation, payment, inventory, voucher reservation, and raw client draft mutation paths', () => {
    const serialized = JSON.stringify(shoppingAssistantEvalFixtures);

    for (const forbiddenCall of forbiddenServiceCalls) {
      expect(serialized).not.toContain(forbiddenCall);
    }

    const blockingFixtures = shoppingAssistantEvalFixtures.filter(
      (fixture) =>
        fixture.expectedFailLabels.includes('prompt_injection_followed') ||
        fixture.expectedFailLabels.includes('direct_order_or_payment_created'),
    );

    expect(blockingFixtures.length).toBeGreaterThanOrEqual(3);
    for (const fixture of blockingFixtures) {
      expect(fixture.expectedGraphPath).toEqual(
        expect.arrayContaining(['unsupported']),
      );
      expect(fixture.allowedServiceCalls).not.toEqual(
        expect.arrayContaining([
          'OrderService.create',
          'PaymentService.createPaymentUrl',
          'reserveForOrder',
          'applyInventoryTransition',
        ]),
      );
    }
  });

  it('keeps memory fixtures room-scoped with no cross-room expected context', () => {
    const memoryFixtures = shoppingAssistantEvalFixtures.filter(
      (fixture) => fixture.scenarioType === 'multi_intent_memory',
    );

    expect(new Set(memoryFixtures.map((fixture) => fixture.roomId)).size).toBe(
      memoryFixtures.length,
    );

    for (const fixture of memoryFixtures) {
      const otherRoomIds = memoryFixtures
        .filter((candidate) => candidate.id !== fixture.id)
        .map((candidate) => candidate.roomId);
      const serialized = JSON.stringify({
        progressiveSummary: fixture.progressiveSummary,
        expectedGraphPath: fixture.expectedGraphPath,
        expectedPassLabels: fixture.expectedPassLabels,
      });

      for (const otherRoomId of otherRoomIds) {
        expect(serialized).not.toContain(otherRoomId);
      }
    }
  });

  it('requires backend-confirmed CHAT-04 action results instead of raw draft client mutation', () => {
    const actionFixtures = shoppingAssistantEvalFixtures.filter((fixture) =>
      fixture.expectedActionDrafts?.length,
    );

    expect(actionFixtures.length).toBeGreaterThanOrEqual(3);
    for (const fixture of actionFixtures) {
      expect(fixture.expectedPassLabels).toEqual(
        expect.arrayContaining(['backend_confirmed_action_required']),
      );
      expect(fixture.expectedFailLabels).toEqual(
        expect.arrayContaining(['raw_client_draft_mutation']),
      );
      for (const draft of fixture.expectedActionDrafts ?? []) {
        expect(draft.requiresConfirmation).toBe(true);
        expect(draft.requiredFields).toEqual(
          expect.arrayContaining(['draftId', 'roomId', 'customerId']),
        );
      }
    }
  });

  it('requires citation and owned-order card fields where applicable', () => {
    const citationFixtures = shoppingAssistantEvalFixtures.filter((fixture) =>
      fixture.expectedCitations?.length,
    );
    const orderFixtures = shoppingAssistantEvalFixtures.filter((fixture) =>
      fixture.expectedOrderCards?.length,
    );

    expect(citationFixtures.length).toBeGreaterThanOrEqual(4);
    expect(orderFixtures.length).toBeGreaterThanOrEqual(1);

    for (const fixture of citationFixtures) {
      for (const citation of fixture.expectedCitations ?? []) {
        expect(citation.requiredFields).toEqual(
          expect.arrayContaining(['title', 'url', 'source']),
        );
      }
    }

    for (const fixture of orderFixtures) {
      for (const orderCard of fixture.expectedOrderCards ?? []) {
        expect(orderCard.ownedOnly).toBe(true);
        expect(orderCard.requiredFields).toEqual(
          expect.arrayContaining(['orderId', 'status']),
        );
      }
    }
  });
});
