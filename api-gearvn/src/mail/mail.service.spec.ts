import * as fs from 'fs';
import * as path from 'path';

import { InternalServerErrorException } from '@nestjs/common';

import { MailService } from './mail.service';

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}));

describe('MailService templates', () => {
  const user = {
    fullName: 'Test Customer',
    email: 'customer@example.com',
  } as any;

  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({ id: 'email-id' });
    process.env.APP_URL = 'https://gearvn.test';
    process.env.MAIL_FROM = 'noreply@gearvn.test';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the source confirmation template and sends it through Resend', async () => {
    const service = new MailService();

    await service.sendUserConfirmation(user, 'confirm-token');

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'GearVN <noreply@gearvn.test>',
        to: user.email,
        subject: expect.stringContaining('Xác minh'),
        html: expect.stringContaining('confirm-token'),
      }),
    );
  });

  it('falls back to dist/mail/templates when runtime-local and source templates are missing', async () => {
    const distTemplatePath = path.join(
      process.cwd(),
      'dist',
      'mail',
      'templates',
      'reset-password.hbs',
    );
    jest
      .spyOn(fs, 'existsSync')
      .mockImplementation((candidate) => candidate === distTemplatePath);
    const readFileSync = jest
      .spyOn(fs, 'readFileSync')
      .mockReturnValue('Hello {{name}} {{url}}' as any);

    const service = new MailService();

    await service.sendResetPassword(user, 'reset-token');

    expect(readFileSync).toHaveBeenCalledWith(distTemplatePath, 'utf8');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: 'Hello Test Customer https://gearvn.test?resetToken&#x3D;reset-token',
      }),
    );
  });

  it('throws a clear internal error when a template is missing from every runtime path', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const service = new MailService();

    await expect(
      service.sendResetPassword(user, 'reset-token'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
