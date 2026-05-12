import { CustomerAssistantProfileService } from './customer-assistant-profile.service';

function execResult<T>(value: T) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

describe('CustomerAssistantProfileService', () => {
  it('lets latest explicit phone and address values win without erasing missing fields', async () => {
    const existing = {
      customerId: 'customer-1',
      preferences: ['laptop gaming'],
      budgetRange: '20 triệu',
      brandPreferences: ['ASUS'],
      useCases: ['gaming'],
      specPreferences: { gpu: 'RTX 4060' },
      productsOfInterest: ['Laptop A'],
      name: 'An',
      phone: '0900000000',
      address: 'Địa chỉ cũ',
    };
    const profileModel = {
      findOne: jest.fn().mockReturnValue(execResult(existing)),
      findOneAndUpdate: jest.fn().mockReturnValue(execResult({ customerId: 'customer-1' })),
    };
    const service = new CustomerAssistantProfileService(profileModel as any);

    await service.mergeExtractedMemory('customer-1', {
      phone: '0912345678',
      address: '',
      preferences: [],
      brandPreferences: ['Lenovo'],
    });

    expect(profileModel.findOneAndUpdate).toHaveBeenCalledWith(
      { customerId: 'customer-1' },
      {
        $set: expect.objectContaining({
          phone: '0912345678',
          address: 'Địa chỉ cũ',
          preferences: ['laptop gaming'],
          brandPreferences: ['ASUS', 'Lenovo'],
        }),
        $setOnInsert: { customerId: 'customer-1' },
      },
      { new: true, upsert: true, runValidators: true },
    );
  });

  it('builds a Vietnamese redacted prompt section for saved profile memory', async () => {
    const profileModel = {
      findOne: jest.fn().mockReturnValue(
        execResult({
          preferences: ['laptop học AI'],
          budgetRange: '25 triệu',
          brandPreferences: ['Lenovo'],
          useCases: ['học AI'],
          specPreferences: { gpu: 'RTX 4060' },
          productsOfInterest: ['Laptop Legion'],
          name: 'An',
          phone: '0912345678',
          address: '1 Nguyễn Huệ, Quận 1, TP.HCM',
        }),
      ),
    };
    const service = new CustomerAssistantProfileService(profileModel as any);

    const section = await service.buildRedactedPromptSection('customer-1');

    expect(section).toContain('Hồ sơ hỗ trợ đã lưu');
    expect(section).toContain('Sở thích ổn định: laptop học AI');
    expect(section).toContain('SĐT đã lưu: 091****678');
    expect(section).toContain('phải nhắc lại và hỏi khách có muốn đổi trước checkout');
    expect(section).not.toContain('0912345678');
    expect(section).not.toContain('1 Nguyễn Huệ, Quận 1, TP.HCM');
  });
});
