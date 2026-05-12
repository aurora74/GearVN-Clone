import {
  comboGroupsFromIntentPrimitives,
  constraintsFromIntentPrimitives,
  detectIntentPrimitives,
  expandWithIntentPrimitives,
  GEARVN_INTENT_PRIMITIVE_IDS,
  PRODUCT_INTENT_PRIMITIVES,
  TEACHER_INTENT_PRIMITIVE_IDS,
} from './product-intent-primitives';

describe('Phase 10 product intent primitives', () => {
  it('exports the locked teacher and GearVN primitive ID sets', () => {
    expect(TEACHER_INTENT_PRIMITIVE_IDS).toEqual([
      'GAMING',
      'AI_ML_LEARNING',
      'WORK_FROM_HOME',
      'GIFT',
      'STUDENT',
      'CONTENT_CREATION',
      'EYE_COMFORT',
    ]);
    expect(GEARVN_INTENT_PRIMITIVE_IDS).toEqual([
      'OFFICE_PRODUCTIVITY',
      'PORTABLE_WORK',
      'LIVE_STREAMING',
      'VALUE_PERFORMANCE',
    ]);

    for (const id of [
      ...TEACHER_INTENT_PRIMITIVE_IDS,
      ...GEARVN_INTENT_PRIMITIVE_IDS,
    ]) {
      expect(PRODUCT_INTENT_PRIMITIVES[id]).toMatchObject({
        id,
        terms: expect.any(Array),
        productGroups: expect.any(Array),
        hardCriteria: expect.any(Object),
        softSignals: expect.any(Array),
        expandedKeywords: expect.any(Array),
        comboGroups: expect.any(Array),
      });
    }
  });

  it('maps AI learning laptop queries to executable technical criteria', () => {
    expect(detectIntentPrimitives('laptop học AI').map((primitive) => primitive.id)).toContain(
      'AI_ML_LEARNING',
    );
    expect(PRODUCT_INTENT_PRIMITIVES.AI_ML_LEARNING.productGroups).toContain('laptop');
    expect(constraintsFromIntentPrimitives('laptop học AI')).toMatchObject({
      categoryHints: ['laptop'],
      requiredSpecs: {
        ramGb: 16,
        ssdGb: 512,
        gpu: 'nvidia',
      },
    });
    expect(expandWithIntentPrimitives('laptop học AI')).toEqual(
      expect.arrayContaining(['CUDA', 'NVIDIA', 'RTX', 'RAM 16GB', 'sinh viên IT']),
    );
  });

  it('maps home-office setup queries to combo product groups', () => {
    expect(detectIntentPrimitives('setup làm việc tại nhà').map((primitive) => primitive.id)).toContain(
      'WORK_FROM_HOME',
    );
    expect(comboGroupsFromIntentPrimitives('setup làm việc tại nhà')).toEqual(
      expect.arrayContaining(['monitor', 'keyboard', 'mouse', 'webcam', 'usb-c-hub']),
    );
  });

  it('covers gift and eye-comfort teacher examples', () => {
    expect(detectIntentPrimitives('quà cho bạn trai thích game').map((primitive) => primitive.id)).toEqual(
      expect.arrayContaining(['GIFT', 'GAMING']),
    );
    expect(detectIntentPrimitives('màn hình đỡ mỏi mắt').map((primitive) => primitive.id)).toContain(
      'EYE_COMFORT',
    );
  });
});
