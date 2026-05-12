import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CustomerAssistantProfile,
  CustomerAssistantProfileDocument,
} from './customer-assistant-profile.schema';

export type CustomerAssistantProfileUpdate = Partial<
  Pick<
    CustomerAssistantProfile,
    | 'preferences'
    | 'budgetRange'
    | 'brandPreferences'
    | 'useCases'
    | 'specPreferences'
    | 'productsOfInterest'
    | 'name'
    | 'phone'
    | 'address'
  >
>;

export type CustomerAssistantCheckoutProfile = {
  name?: string;
  phone?: string;
  address?: string;
};

export type CustomerAssistantPromptProfile = {
  preferences: string[];
  budgetRange?: string;
  brandPreferences: string[];
  useCases: string[];
  specPreferences: Record<string, unknown>;
  productsOfInterest: string[];
  name?: string;
  phoneMasked?: string;
  addressPreview?: string;
};

@Injectable()
export class CustomerAssistantProfileService {
  constructor(
    @InjectModel(CustomerAssistantProfile.name)
    private readonly profileModel: Model<CustomerAssistantProfileDocument>,
  ) {}

  async getForPrompt(
    customerId: string,
  ): Promise<CustomerAssistantPromptProfile | null> {
    const profile = await this.profileModel.findOne({ customerId }).exec();
    if (!profile) return null;

    return {
      preferences: profile.preferences ?? [],
      budgetRange: profile.budgetRange || undefined,
      brandPreferences: profile.brandPreferences ?? [],
      useCases: profile.useCases ?? [],
      specPreferences: profile.specPreferences ?? {},
      productsOfInterest: profile.productsOfInterest ?? [],
      name: profile.name || undefined,
      phoneMasked: maskPhone(profile.phone),
      addressPreview: previewAddress(profile.address),
    };
  }

  async getCheckoutFields(
    customerId: string,
  ): Promise<CustomerAssistantCheckoutProfile | null> {
    const profile = await this.profileModel.findOne({ customerId }).exec();
    if (!profile) return null;

    return {
      name: profile.name || undefined,
      phone: profile.phone || undefined,
      address: profile.address || undefined,
    };
  }

  async mergeExtractedMemory(
    customerId: string,
    update: CustomerAssistantProfileUpdate,
  ): Promise<CustomerAssistantProfileDocument> {
    const existing = await this.profileModel.findOne({ customerId }).exec();
    const now = new Date();
    const next: Partial<CustomerAssistantProfile> = {
      customerId,
      preferences: mergeUnique(existing?.preferences, update.preferences),
      brandPreferences: mergeUnique(
        existing?.brandPreferences,
        update.brandPreferences,
      ),
      useCases: mergeUnique(existing?.useCases, update.useCases),
      productsOfInterest: mergeUnique(
        existing?.productsOfInterest,
        update.productsOfInterest,
      ),
      specPreferences: {
        ...(existing?.specPreferences ?? {}),
        ...(update.specPreferences ?? {}),
      },
      lastExtractedAt: now,
    };

    for (const key of ['budgetRange', 'name', 'phone', 'address'] as const) {
      const value = update[key];
      next[key] = typeof value === 'string' && value.trim() ? value.trim() : existing?.[key] ?? '';
    }

    const saved = await this.profileModel
      .findOneAndUpdate(
        { customerId },
        { $set: next, $setOnInsert: { customerId } },
        { new: true, upsert: true, runValidators: true },
      )
      .exec();

    return saved;
  }

  async buildRedactedPromptSection(customerId: string): Promise<string> {
    const profile = await this.getForPrompt(customerId);
    if (!profile) return '';

    const lines = [
      profile.preferences.length
        ? `Sở thích ổn định: ${profile.preferences.join(', ')}`
        : '',
      profile.budgetRange ? `Ngân sách thường nhắc: ${profile.budgetRange}` : '',
      profile.brandPreferences.length
        ? `Thương hiệu ưu tiên: ${profile.brandPreferences.join(', ')}`
        : '',
      profile.useCases.length
        ? `Nhu cầu sử dụng: ${profile.useCases.join(', ')}`
        : '',
      Object.keys(profile.specPreferences).length
        ? `Cấu hình ưu tiên: ${JSON.stringify(profile.specPreferences)}`
        : '',
      profile.productsOfInterest.length
        ? `Sản phẩm quan tâm: ${profile.productsOfInterest.join(', ')}`
        : '',
      profile.name ? `Tên giao hàng đã lưu: ${profile.name}` : '',
      profile.phoneMasked
        ? `SĐT đã lưu: ${profile.phoneMasked} (phải nhắc lại và hỏi khách có muốn đổi trước checkout)`
        : '',
      profile.addressPreview
        ? `Địa chỉ đã lưu: ${profile.addressPreview} (phải nhắc lại và hỏi khách có muốn đổi trước checkout)`
        : '',
    ].filter(Boolean);

    if (!lines.length) return '';
    return ['Hồ sơ hỗ trợ đã lưu', ...lines].join('\n');
  }
}

function mergeUnique(current: string[] = [], incoming?: string[]): string[] {
  const values = [...current, ...(incoming ?? [])]
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}

function maskPhone(phone?: string): string | undefined {
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (digits.length < 4) return undefined;
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

function previewAddress(address?: string): string | undefined {
  const normalized = address?.trim();
  if (!normalized) return undefined;
  if (normalized.length <= 24) return normalized;
  return `${normalized.slice(0, 12)}...${normalized.slice(-8)}`;
}
