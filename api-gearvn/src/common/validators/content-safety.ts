import { BadRequestException } from '@nestjs/common';

const UNSAFE_PLAIN_TEXT_PATTERN =
  /<\s*\/?\s*script\b|javascript\s*:|on[a-z]+\s*=/i;

export const sanitizePlainTextContent = (
  value?: string,
  fieldName = 'Content',
): string => {
  const normalized = value?.trim();

  if (!normalized) {
    throw new BadRequestException(`${fieldName} is required`);
  }

  if (UNSAFE_PLAIN_TEXT_PATTERN.test(normalized)) {
    throw new BadRequestException(`${fieldName} is not allowed`);
  }

  return normalized;
};
