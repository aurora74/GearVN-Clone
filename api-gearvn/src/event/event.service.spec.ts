import { EventService } from './event.service';
import { UserRole } from '../auth/enums/user-role.enum';
import { getFlashSaleStatus } from './helper/flash-sale-status';
import { isPromotionEligibleProduct } from '../product/helper/promotion-product-eligibility';

describe('flash-sale event status', () => {
  const now = new Date('2026-05-02T08:00:00.000Z');

  it('returns disabled when the event is disabled', () => {
    expect(
      getFlashSaleStatus(
        {
          startsAt: '2026-05-02T07:00:00.000Z',
          endsAt: '2026-05-02T09:00:00.000Z',
          isEnabled: false,
        },
        now,
      ),
    ).toBe('disabled');
  });

  it('returns scheduled before the start time', () => {
    expect(
      getFlashSaleStatus(
        {
          startsAt: '2026-05-02T09:00:00.000Z',
          endsAt: '2026-05-02T10:00:00.000Z',
          isEnabled: true,
        },
        now,
      ),
    ).toBe('scheduled');
  });

  it('returns active inside the time window', () => {
    expect(
      getFlashSaleStatus(
        {
          startsAt: '2026-05-02T07:00:00.000Z',
          endsAt: '2026-05-02T09:00:00.000Z',
          isEnabled: true,
        },
        now,
      ),
    ).toBe('active');
  });

  it('returns ended at or after the end time', () => {
    expect(
      getFlashSaleStatus(
        {
          startsAt: '2026-05-02T07:00:00.000Z',
          endsAt: '2026-05-02T08:00:00.000Z',
          isEnabled: true,
        },
        now,
      ),
    ).toBe('ended');
  });
});

describe('product promotion eligibility', () => {
  it('rejects products with no stock', () => {
    expect(isPromotionEligibleProduct({ stock: 0 })).toBe(false);
  });

  it('rejects products with unpublished visibility flags when present', () => {
    expect(isPromotionEligibleProduct({ stock: 3, isPublished: false })).toBe(
      false,
    );
    expect(isPromotionEligibleProduct({ stock: 3, available: false })).toBe(
      false,
    );
    expect(isPromotionEligibleProduct({ stock: 3, status: 'hidden' })).toBe(
      false,
    );
  });

  it('accepts in-stock products without unpublished visibility markers', () => {
    expect(isPromotionEligibleProduct({ stock: 3 })).toBe(true);
    expect(
      isPromotionEligibleProduct({
        stock: 3,
        isPublished: true,
        available: true,
        status: 'published',
      }),
    ).toBe(true);
  });
});

describe('EventService flash-sale lifecycle', () => {
  const now = new Date('2026-05-02T08:00:00.000Z');
  const actor = { id: 'staff-id', role: UserRole.PRODUCT_MARKETING_STAFF };
  const requestContext = { ip: '127.0.0.1', userAgent: 'jest' };

  const createService = (event: any) => {
    const eventModel = {
      findById: jest.fn().mockResolvedValue(event),
    };
    const cloudinaryService = { uploadImage: jest.fn() };
    const auditService = { record: jest.fn().mockResolvedValue({}) };

    return {
      eventModel,
      auditService,
      service: new EventService(
        eventModel as any,
        cloudinaryService as any,
        auditService as any,
      ),
    };
  };

  it('setEnabled(false) disables an event and audits the change', async () => {
    const event: any = {
      _id: 'event-id',
      tag: 'laptopSale',
      startsAt: new Date('2026-05-02T07:00:00.000Z'),
      endsAt: new Date('2026-05-02T09:00:00.000Z'),
      isEnabled: true,
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
    };
    const { service, auditService } = createService(event);

    const result = await service.setEnabled(
      'event-id',
      false,
      actor,
      requestContext,
      'Pause campaign',
      now,
    );

    expect(result.status).toBe('disabled');
    expect(event.isEnabled).toBe(false);
    expect(event.disabledAt).toEqual(now);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'FLASH_SALE_DISABLED',
        targetType: 'flash-sale',
        targetId: 'event-id',
        reason: 'Pause campaign',
      }),
    );
  });

  it('setEnabled(true) clears disabledAt and returns server-derived status', async () => {
    const event: any = {
      _id: 'event-id',
      tag: 'laptopSale',
      startsAt: new Date('2026-05-02T07:00:00.000Z'),
      endsAt: new Date('2026-05-02T09:00:00.000Z'),
      isEnabled: false,
      disabledAt: new Date('2026-05-02T07:30:00.000Z'),
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
    };
    const { service } = createService(event);

    const result = await service.setEnabled(
      'event-id',
      true,
      actor,
      requestContext,
      'Resume campaign',
      now,
    );

    expect(result.status).toBe('active');
    expect(event.isEnabled).toBe(true);
    expect(event.disabledAt).toBeUndefined();
  });

  it('endNow sets endsAt to server time and audits the change', async () => {
    const event: any = {
      _id: 'event-id',
      tag: 'laptopSale',
      startsAt: new Date('2026-05-02T07:00:00.000Z'),
      endsAt: new Date('2026-05-02T09:00:00.000Z'),
      isEnabled: true,
      save: jest.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      }),
    };
    const { service, auditService } = createService(event);

    const result = await service.endNow(
      'event-id',
      actor,
      requestContext,
      'End campaign',
      now,
    );

    expect(result.status).toBe('ended');
    expect(event.endsAt).toEqual(now);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'FLASH_SALE_ENDED',
        targetType: 'flash-sale',
        targetId: 'event-id',
      }),
    );
  });
});
