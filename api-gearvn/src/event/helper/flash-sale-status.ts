export type FlashSaleStatus = 'scheduled' | 'active' | 'ended' | 'disabled';

export const getFlashSaleStatus = (
  event: {
    startsAt?: Date | string;
    endsAt?: Date | string;
    isEnabled?: boolean;
  },
  now = new Date(),
): FlashSaleStatus => {
  if (event.isEnabled === false) {
    return 'disabled';
  }

  const startsAt = event.startsAt ? new Date(event.startsAt).getTime() : NaN;
  const endsAt = event.endsAt ? new Date(event.endsAt).getTime() : NaN;
  const currentTime = now.getTime();

  if (Number.isFinite(startsAt) && currentTime < startsAt) {
    return 'scheduled';
  }

  if (Number.isFinite(endsAt) && currentTime >= endsAt) {
    return 'ended';
  }

  return 'active';
};
