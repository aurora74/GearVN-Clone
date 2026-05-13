import { AssistantIntent } from '../assistant.types';
import { ResponseMergerService } from './response-merger.service';

describe('ResponseMergerService', () => {
  it('bypasses the chat model for exactly one non-empty response', async () => {
    const service = new ResponseMergerService();
    const model = { invoke: jest.fn() };
    const result = await service.mergeAssistantResponses(
      {
        responses: [
          {
            intent: AssistantIntent.PRODUCT_ADVICE,
            nodeName: 'product_advice',
            text: 'Mình tìm thấy sản phẩm phù hợp.',
            metadata: { productCards: [{ productId: 'p1' }] },
          },
        ],
        locale: 'vi-VN',
      },
      model,
    );

    expect(model.invoke).not.toHaveBeenCalled();
    expect(result.text).toBe('Mình tìm thấy sản phẩm phù hợp.');
    expect(result.trace.mode).toBe('single_response_bypass');
    expect(result.metadata.productCards).toEqual([{ productId: 'p1' }]);
  });

  it('dedupes product cards by productId during single-response metadata bypass', async () => {
    const service = new ResponseMergerService();
    const result = await service.mergeAssistantResponses({
      responses: [
        {
          intent: AssistantIntent.PRODUCT_ADVICE,
          nodeName: 'product_advice',
          text: 'Mình tìm thấy sản phẩm phù hợp.',
          metadata: {
            productCards: [
              { productId: 'p1', name: 'Laptop Alpha' },
              { productId: 'p1', name: 'Laptop Alpha duplicate' },
              { productId: 'p2', name: 'Laptop Beta' },
            ],
          },
        },
      ],
      locale: 'vi-VN',
    });

    expect(result.metadata.productCards).toEqual([
      { productId: 'p1', name: 'Laptop Alpha' },
      { productId: 'p2', name: 'Laptop Beta' },
    ]);
  });
  it('uses the planner for multiple responses and preserves structured metadata from sources', async () => {
    const service = new ResponseMergerService();
    const productCards = [{ productId: 'p1', name: 'Laptop Alpha' }];
    const actionDrafts = [{ draftId: 'd1', kind: 'CART_ADD' }];
    const model = {
      invoke: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          finalMessage:
            'Mình đề xuất Laptop Alpha và đã chuẩn bị thao tác thêm vào giỏ để bạn xác nhận.',
          priorityOrder: ['product_advice', 'cart_action'],
          selectedResponseIds: ['product_advice', 'cart_action'],
          droppedDuplicateResponseIds: [],
          metadataPreserved: ['productCards', 'actionDrafts'],
          factSources: ['product_advice.productCards', 'cart_action.actionDrafts'],
          unsupportedReason: null,
          confidence: 0.9,
        }),
      }),
    };

    const result = await service.mergeAssistantResponses(
      {
        responses: [
          {
            intent: AssistantIntent.PRODUCT_ADVICE,
            nodeName: 'product_advice',
            text: 'Laptop Alpha phù hợp.',
            metadata: { productCards, active_subgraph: 'sales' },
          },
          {
            intent: AssistantIntent.CART_ACTION,
            nodeName: 'cart_action',
            text: 'Mình đã chuẩn bị thao tác thêm vào giỏ.',
            metadata: { actionDrafts, active_subgraph: 'order' },
          },
        ],
        locale: 'vi-VN',
      },
      model,
    );

    expect(model.invoke).toHaveBeenCalledTimes(1);
    expect(result.text).toContain('đã chuẩn bị thao tác');
    expect(result.metadata.productCards).toEqual(productCards);
    expect(result.metadata.actionDrafts).toEqual(actionDrafts);
    expect(result.trace).toEqual(
      expect.objectContaining({
        mode: 'llm_planner_merge',
        responseCount: 2,
        selectedResponseIds: ['product_advice', 'cart_action'],
        droppedDuplicateResponseIds: [],
      }),
    );
  });

  it('preserves product consultation metadata during multi-response merge', async () => {
    const service = new ResponseMergerService();
    const model = {
      invoke: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          finalMessage: 'Mình đã lọc lại sản phẩm và chuẩn bị thao tác giỏ hàng.',
          priorityOrder: ['product_advice', 'cart_action'],
          selectedResponseIds: ['product_advice', 'cart_action'],
          droppedDuplicateResponseIds: [],
          metadataPreserved: ['productCards', 'actionDrafts'],
          factSources: ['product_advice.productCards'],
          unsupportedReason: null,
          confidence: 0.9,
        }),
      }),
    };

    const result = await service.mergeAssistantResponses(
      {
        responses: [
          {
            intent: AssistantIntent.PRODUCT_ADVICE,
            nodeName: 'product_advice',
            text: 'Mình đã lọc thêm lựa chọn khác.',
            metadata: {
              productCards: [{ productId: 'p2', name: 'Laptop Beta' }],
              consultationMode: 'more_options',
              priorRecommendationProductIds: ['p1'],
              comparedProductIds: ['p2'],
              recommendationContinuity: {
                mode: 'more_options',
                hasPriorRecommendations: true,
                priorRecommendationProductIds: ['p1'],
                comparedProductIds: ['p2'],
                preferenceDelta: 'ưu tiên pin hơn',
              },
              llmComposeStatus: 'fallback',
              llmComposeFallbackReason: 'composer_returned_empty',
            },
          },
          {
            intent: AssistantIntent.CART_ACTION,
            nodeName: 'cart_action',
            text: 'Mình đã chuẩn bị thao tác thêm vào giỏ.',
            metadata: { actionDrafts: [{ draftId: 'd1', kind: 'CART_ADD' }] },
          },
        ],
        locale: 'vi-VN',
      },
      model,
    );

    expect(result.metadata).toMatchObject({
      consultationMode: 'more_options',
      priorRecommendationProductIds: ['p1'],
      comparedProductIds: ['p2'],
      recommendationContinuity: expect.objectContaining({
        mode: 'more_options',
        preferenceDelta: 'ưu tiên pin hơn',
      }),
      llmComposeStatus: 'fallback',
      llmComposeFallbackReason: 'composer_returned_empty',
    });
  });

  it('preserves structured metadata even when the planner selects only prose', async () => {
    const service = new ResponseMergerService();
    const actionDrafts = [{ draftId: 'draft-1', kind: 'CART_ADD' }];
    const checkoutReview = { missingFields: [], actions: ['confirm'] };
    const productCards = [{ productId: 'p1', name: 'Laptop Alpha' }];
    const model = {
      invoke: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          finalMessage: 'Laptop Alpha phu hop voi nhu cau cua ban.',
          priorityOrder: ['product_advice'],
          selectedResponseIds: ['product_advice'],
          droppedDuplicateResponseIds: ['cart_action'],
          metadataPreserved: ['productCards'],
          factSources: ['product_advice.productCards'],
          unsupportedReason: null,
          confidence: 0.9,
        }),
      }),
    };

    const result = await service.mergeAssistantResponses(
      {
        responses: [
          {
            intent: AssistantIntent.PRODUCT_ADVICE,
            nodeName: 'product_advice',
            text: 'Laptop Alpha phu hop.',
            metadata: { productCards, active_subgraph: 'sales' },
          },
          {
            intent: AssistantIntent.CART_ACTION,
            nodeName: 'cart_action',
            text: 'Da chuan bi thao tac gio hang.',
            metadata: {
              actionDrafts,
              checkoutReview,
              active_subgraph: 'order',
            },
          },
        ],
        locale: 'vi-VN',
      },
      model,
    );

    expect(result.responses).toHaveLength(1);
    expect(result.trace.selectedResponseIds).toEqual(['product_advice']);
    expect(result.trace.sourceSubgraphs).toEqual(['sales', 'order']);
    expect(result.metadata.productCards).toEqual(productCards);
    expect(result.metadata.actionDrafts).toEqual(actionDrafts);
    expect(result.metadata.checkoutReview).toEqual(checkoutReview);
  });

  it('falls back deterministically with bounded text when planner output is invalid', async () => {
    const service = new ResponseMergerService();
    const longReviewText = `Review ${'rất dài '.repeat(400)}`;
    const model = {
      invoke: jest.fn().mockResolvedValue({ content: '{"finalMessage":"cut"' }),
    };

    const result = await service.mergeAssistantResponses(
      {
        responses: [
          {
            intent: AssistantIntent.REVIEW_SUMMARY,
            nodeName: 'review_summary',
            text: longReviewText,
            metadata: { reviewSummary: { heading: 'review' } },
          },
          {
            intent: AssistantIntent.PRODUCT_ADVICE,
            nodeName: 'product_advice',
            text: 'Mình gợi ý Laptop Alpha vì khớp nhu cầu của bạn.',
            metadata: { productCards: [{ productId: 'p1' }] },
          },
        ],
        locale: 'vi-VN',
      },
      model,
    );

    expect(result.trace.mode).toBe('deterministic_fallback');
    expect(result.text).toContain('Laptop Alpha');
    expect(result.text.length).toBeLessThanOrEqual(1800);
    expect(result.metadata.productCards).toEqual([{ productId: 'p1' }]);
    expect(result.metadata.reviewSummary).toEqual({ heading: 'review' });
  });
});
