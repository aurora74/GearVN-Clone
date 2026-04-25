import * as streamifier from 'streamifier';
import { UploadApiResponse } from 'cloudinary';
import { Injectable, Inject } from '@nestjs/common';

type CloudinaryDeleteResult = { publicId: string; result?: string };

@Injectable()
export class CloudinaryService {
  constructor(@Inject('CLOUDINARY') private readonly cloud: any) {}

  async uploadImage(
    file: Express.Multer.File,
    folder = 'products',
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = this.cloud.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result as UploadApiResponse);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteImage(urlOrPublicId: string): Promise<CloudinaryDeleteResult | null> {
    const publicId = this.extractPublicId(urlOrPublicId);
    if (!publicId) return null;

    const result = await this.cloud.uploader.destroy(publicId, {
      resource_type: 'image',
    });

    return { publicId, result: result?.result };
  }

  private extractPublicId(urlOrPublicId: string): string | null {
    const value = urlOrPublicId?.trim();
    if (!value) return null;

    if (!/^https?:\/\//i.test(value)) {
      return this.stripExtension(value.split('?')[0]);
    }

    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }

    if (!url.hostname.endsWith('cloudinary.com')) return null;

    const segments = url.pathname.split('/').filter(Boolean);
    const uploadIndex = segments.indexOf('upload');
    if (uploadIndex === -1) return null;

    const publicIdSegments = segments.slice(uploadIndex + 1);
    if (publicIdSegments[0]?.match(/^v\d+$/)) {
      publicIdSegments.shift();
    }

    return this.stripExtension(publicIdSegments.join('/'));
  }

  private stripExtension(publicId: string): string | null {
    const normalized = publicId.trim().replace(/^\/+/, '');
    if (!normalized) return null;

    return normalized.replace(/\.[^/.]+$/, '');
  }
}
