import {
  reviewSummaryNode,
  ReviewSearchClient,
  ReviewSummarySchema,
} from './review-summary.node';

const publicReviewSources = [
  {
    title: 'Review laptop RTX 4060 sau 2 tuan su dung',
    url: 'https://reviews.example.test/laptop-rtx-4060',
    publishedAt: '2026-04-12T08:00:00.000Z',
    snippet:
      'Nhieu nguon nhac may manh khi choi game, quat hoi on khi tai nang.',
    claims: [
      {
        text: 'Hieu nang gaming on dinh voi RTX 4060 o muc Full HD.',
        evidenceStrength: 'repeated',
      },
      {
        text: 'Quat co the on khi render hoac choi game nang.',
        evidenceStrength: 'weak',
        uncertainty: 'Phu thuoc profile quat va nhiet do phong.',
      },
    ],
  },
  {
    title: 'So sanh bien the RTX 4060 va RTX 4050',
    url: 'https://tech.example.test/rtx-4060-vs-4050',
    publishedAt: '2026-03-20T08:00:00.000Z',
    snippet:
      'Ket qua thay doi theo bien the TGP, can doi chieu dung SKU ban tai Viet Nam.',
    claims: [
      {
        text: 'Ket qua benchmark co the khac neu bien the TGP thap hon.',
        evidenceStrength: 'variant-specific',
        uncertainty: 'Can kiem chung dung ma san pham GearVN dang ban.',
      },
    ],
  },
];

describe('reviewSummaryNode', () => {
  const reviewSearchClient = {
    search: jest.fn(),
  } as unknown as jest.Mocked<ReviewSearchClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    reviewSearchClient.search.mockResolvedValue(publicReviewSources);
  });

  it('CHAT-03 D-14 does not invoke web review search for non-review product advice intent', async () => {
    const result = await reviewSummaryNode(
      {
        userText: 'Tu van laptop gaming tam 25 trieu',
        intentPlan: { needsProductRetrieval: true, needsReviewSummary: false },
      },
      { reviewSearchClient },
    );

    expect(reviewSearchClient.search).not.toHaveBeenCalled();
    expect(result.metadata.reviewSummary).toBeUndefined();
  });

  it('does not run public web search for broad catalog detail wording without explicit public-source wording', async () => {
    const result = await reviewSummaryNode(
      {
        userText:
          'review chi tiết cho mình con Lenovo ThinkBook 14 G7 IML 21MR006YVN',
        intentPlan: { needsReviewSummary: false },
      },
      { reviewSearchClient },
    );

    expect(reviewSearchClient.search).not.toHaveBeenCalled();
    expect(result.metadata.reviewSummary).toBeUndefined();
  });

  it.each([
    'trên mạng nói gì về mẫu này',
    'cho mình nguồn công khai về mẫu này',
    'review cộng đồng của mẫu này ra sao',
    'có citation hoặc nguồn trích dẫn công khai không',
  ])('runs public review search for explicit public-source wording: %s', async (prompt) => {
    const result = await reviewSummaryNode(
      {
        userText: prompt,
        intentPlan: { needsReviewSummary: true },
      },
      { reviewSearchClient },
    );

    expect(reviewSearchClient.search).toHaveBeenCalledWith(
      prompt,
      [],
      expect.any(Object),
    );
    expect(result.metadata.reviewSummary.heading).toBe(
      'Tóm tắt đánh giá từ nguồn công khai',
    );
  });

  it('CHAT-03 D-15 returns summary, repeatedFindings, needsVerification, and insufficientSources with exact UI labels', async () => {
    const result = await reviewSummaryNode(
      {
        userText: 'Tom tat danh gia va so sanh laptop RTX 4060 nay',
        intentPlan: {
          needsReviewSummary: true,
          comparedProductIds: ['p-4060'],
        },
      },
      { reviewSearchClient },
    );

    expect(result.metadata.reviewSummary).toMatchObject({
      heading: 'Tóm tắt đánh giá từ nguồn công khai',
      summary: expect.stringContaining('Các nguồn công khai'),
      repeatedFindings: expect.objectContaining({
        label: 'Nhiều nguồn cùng nhắc',
        claims: expect.any(Array),
      }),
      needsVerification: expect.objectContaining({
        label: 'Cần kiểm chứng',
        claims: expect.any(Array),
      }),
      insufficientSources: expect.objectContaining({
        label: 'Chưa đủ nguồn',
        claims: expect.any(Array),
      }),
    });
    expect(ReviewSummarySchema.parse(result.metadata.reviewSummary)).toEqual(
      result.metadata.reviewSummary,
    );
  });

  it('CHAT-03 attaches citations and uncertainty to every weak, stale, sponsored, variant-specific, or conflicting web-derived claim', async () => {
    const result = await reviewSummaryNode(
      {
        userText: 'Nguon review noi gi ve laptop RTX 4060?',
        intentPlan: { needsReviewSummary: true },
      },
      { reviewSearchClient },
    );

    const claimGroups = [
      ...result.metadata.reviewSummary.repeatedFindings.claims,
      ...result.metadata.reviewSummary.needsVerification.claims,
      ...result.metadata.reviewSummary.insufficientSources.claims,
    ];

    expect(claimGroups).not.toHaveLength(0);
    for (const claim of claimGroups) {
      expect(claim.citations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: expect.stringMatching(/^https:\/\//),
          }),
        ]),
      );
      if (
        [
          'weak',
          'stale',
          'sponsored',
          'variant-specific',
          'conflicting',
        ].includes(claim.evidenceKind)
      ) {
        expect(claim.uncertainty).toEqual(expect.any(String));
      }
    }
  });

  it('CHAT-03 suppresses unsupported claims when citation lookup fails and returns a safe insufficient-source message', async () => {
    reviewSearchClient.search.mockResolvedValueOnce([
      {
        title: 'Nguon khong co URL',
        url: '',
        snippet:
          '<script>alert("xss")</script> San pham chac chan tot nhat moi tam gia.',
        claims: [
          {
            text: 'San pham chac chan tot nhat moi tam gia.',
            evidenceStrength: 'unsupported',
          },
        ],
      },
    ]);

    const result = await reviewSummaryNode(
      {
        userText: 'Review san pham nay co tot khong?',
        intentPlan: { needsReviewSummary: true },
      },
      { reviewSearchClient },
    );

    expect(result.text).toContain(
      'Mình chưa đủ nguồn đáng tin cậy để tóm tắt đánh giá',
    );
    expect(result.metadata.reviewSummary.insufficientSources.claims).toEqual(
      [],
    );
    expect(result.text).not.toContain('chac chan tot nhat');
  });

  it('returns safe insufficient-source text when review search throws', async () => {
    reviewSearchClient.search.mockRejectedValueOnce(
      new Error('OpenRouter review search request timed out'),
    );

    const result = await reviewSummaryNode(
      {
        userText:
          'review chi tiết Laptop Lenovo ThinkBook 14 G7 IML 21MR006YVN',
        intentPlan: { needsReviewSummary: true },
      },
      { reviewSearchClient },
    );

    expect(result.text).toContain(
      'Mình chưa đủ nguồn đáng tin cậy để tóm tắt đánh giá',
    );
    expect(result.metadata.reviewSummary).toMatchObject({
      repeatedFindings: expect.objectContaining({ claims: [] }),
      needsVerification: expect.objectContaining({ claims: [] }),
      insufficientSources: expect.objectContaining({ claims: [] }),
    });
  });

  it('CHAT-03 renders escaped text and URL strings only, never raw HTML from review sources', async () => {
    reviewSearchClient.search.mockResolvedValueOnce([
      {
        title: '<b>Review HTML</b>',
        url: 'https://reviews.example.test/html',
        snippet:
          '<img src=x onerror=alert(1)> Pin kha tot theo nguon cong khai.',
        claims: [
          {
            text: '<strong>Pin kha tot</strong>',
            evidenceStrength: 'weak',
            uncertainty: 'Nguon don le, can them doi chieu.',
          },
        ],
      },
    ]);

    const result = await reviewSummaryNode(
      {
        userText: 'Co review nao ve pin khong?',
        intentPlan: { needsReviewSummary: true },
      },
      { reviewSearchClient },
    );

    const serialized = JSON.stringify(result.metadata.reviewSummary);
    expect(serialized).not.toMatch(/<\/?[a-z][\s\S]*>/i);
    expect(serialized).toContain('https://reviews.example.test/html');
    expect(serialized).toContain('uncertainty');
    expect(serialized).toContain('citations');
  });

  it('returns safe insufficient-source text for malformed review source payloads', async () => {
    reviewSearchClient.search.mockResolvedValueOnce([
      {
        title: { nested: 'bad' },
        url: 'https://reviews.example.test/malformed',
        claims: [{ text: { bad: true }, evidenceStrength: 'repeated' }],
      } as any,
    ]);

    const result = await reviewSummaryNode(
      {
        userText: 'review chi tiết Lenovo ThinkBook 14 G7 IML 21MR006YVN',
        intentPlan: { needsReviewSummary: true },
      },
      { reviewSearchClient },
    );

    expect(result.text).toContain(
      'Mình chưa đủ nguồn đáng tin cậy để tóm tắt đánh giá',
    );
    expect(result.metadata.reviewSummary.repeatedFindings.claims).toEqual([]);
  });
});
