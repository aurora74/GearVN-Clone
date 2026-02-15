import { BadRequestException } from '@nestjs/common';

import { validateImageUploads } from './upload-validator';

const file = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File =>
  ({
    mimetype: 'image/png',
    size: 1024,
    originalname: 'image.png',
    buffer: Buffer.from('image'),
    ...overrides,
  }) as Express.Multer.File;

describe('validateImageUploads', () => {
  it('accepts common image uploads', () => {
    expect(() =>
      validateImageUploads([
        file({ mimetype: 'image/jpeg' }),
        file({ mimetype: 'image/webp' }),
        file({ mimetype: 'image/gif' }),
      ]),
    ).not.toThrow();
  });

  it('rejects invalid MIME types', () => {
    expect(() =>
      validateImageUploads([file({ mimetype: 'application/pdf' })]),
    ).toThrow(BadRequestException);
  });

  it('rejects oversized uploads', () => {
    expect(() =>
      validateImageUploads([file({ size: 6 * 1024 * 1024 })], {
        maxFileSizeBytes: 5 * 1024 * 1024,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects too many uploads', () => {
    expect(() =>
      validateImageUploads([file(), file()], { maxFiles: 1 }),
    ).toThrow(BadRequestException);
  });

  it('rejects malformed file inputs', () => {
    expect(() => validateImageUploads([{} as Express.Multer.File])).toThrow(
      BadRequestException,
    );
  });
});
