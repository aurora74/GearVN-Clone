import { BadRequestException } from '@nestjs/common';

export interface ImageUploadValidationOptions {
  maxFiles?: number;
  maxFileSizeBytes?: number;
}

const DEFAULT_MAX_FILES = 10;
const DEFAULT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const validateImageUploads = (
  files: Express.Multer.File[] = [],
  options: ImageUploadValidationOptions = {},
): void => {
  if (!Array.isArray(files)) {
    throw new BadRequestException('Invalid upload input');
  }

  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxFileSizeBytes =
    options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;

  if (files.length > maxFiles) {
    throw new BadRequestException('Too many images');
  }

  for (const file of files) {
    if (
      !file ||
      typeof file.mimetype !== 'string' ||
      typeof file.size !== 'number'
    ) {
      throw new BadRequestException('Invalid image upload');
    }

    const normalizedMime = file.mimetype.toLowerCase();
    if (
      !normalizedMime.startsWith('image/') ||
      !ALLOWED_IMAGE_MIME_TYPES.has(normalizedMime)
    ) {
      throw new BadRequestException('Only image uploads are allowed');
    }

    if (file.size > maxFileSizeBytes) {
      throw new BadRequestException('Image is too large');
    }
  }
};
