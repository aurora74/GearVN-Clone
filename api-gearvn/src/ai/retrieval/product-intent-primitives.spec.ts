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
      'ENGINEERING_CAD',
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
    expect(
      detectIntentPrimitives('laptop học AI').map((primitive) => primitive.id),
    ).toContain('AI_ML_LEARNING');
    expect(PRODUCT_INTENT_PRIMITIVES.AI_ML_LEARNING.productGroups).toContain(
      'laptop',
    );
    expect(constraintsFromIntentPrimitives('laptop học AI')).toMatchObject({
      categoryHints: ['laptop'],
      requiredSpecs: {
        ramGb: 16,
        ssdGb: 512,
        gpu: 'nvidia',
      },
    });
    expect(comboGroupsFromIntentPrimitives('laptop học AI')).toEqual([]);
    expect(expandWithIntentPrimitives('laptop học AI')).toEqual(
      expect.arrayContaining([
        'CUDA',
        'NVIDIA',
        'RTX',
        'RAM 16GB',
        'sinh viên IT',
      ]),
    );
    expect(expandWithIntentPrimitives('laptop học AI')).not.toContain(
      'storage',
    );
  });

  it('maps home-office setup queries to combo product groups', () => {
    expect(
      detectIntentPrimitives('setup làm việc tại nhà').map(
        (primitive) => primitive.id,
      ),
    ).toContain('WORK_FROM_HOME');
    expect(comboGroupsFromIntentPrimitives('setup làm việc tại nhà')).toEqual(
      expect.arrayContaining([
        'monitor',
        'keyboard',
        'mouse',
        'webcam',
        'usb-c-hub',
      ]),
    );
  });
  it('promotes explicit setup slot families into canonical combo groups', () => {
    expect(
      comboGroupsFromIntentPrimitives('combo pc bàn ghế livestream'),
    ).toEqual(
      expect.arrayContaining([
        'desktop_pc',
        'desk',
        'chair',
        'webcam',
        'microphone',
      ]),
    );
    expect(comboGroupsFromIntentPrimitives('setup ban-ghe-gaming')).toEqual(
      expect.arrayContaining(['desk', 'chair']),
    );
  });

  it('maps CAD and engineering needs to workstation performance signals without combo grouping', () => {
    const detected = detectIntentPrimitives('PC làm CAD/kỹ thuật').map(
      (primitive) => primitive.id,
    );

    expect(detected).toContain('ENGINEERING_CAD');
    expect(
      constraintsFromIntentPrimitives('PC làm CAD/kỹ thuật'),
    ).toMatchObject({
      requiredSpecs: {
        ramGb: 16,
        gpu: 'nvidia',
      },
    });
    expect(expandWithIntentPrimitives('PC làm CAD/kỹ thuật')).toEqual(
      expect.arrayContaining(['cad', 'autocad', 'workstation', 'RTX']),
    );
    expect(comboGroupsFromIntentPrimitives('PC làm CAD/kỹ thuật')).toEqual([]);
  });
  it('covers gift and eye-comfort teacher examples', () => {
    expect(
      detectIntentPrimitives('quà cho bạn trai thích game').map(
        (primitive) => primitive.id,
      ),
    ).toEqual(expect.arrayContaining(['GIFT', 'GAMING']));
    expect(
      detectIntentPrimitives('màn hình đỡ mỏi mắt').map(
        (primitive) => primitive.id,
      ),
    ).toContain('EYE_COMFORT');
  });
});
