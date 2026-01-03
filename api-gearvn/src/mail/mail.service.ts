import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

import { Resend } from 'resend';
import { Injectable } from '@nestjs/common';

import { User } from 'src/user/user.schema';

@Injectable()
export class MailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  private compileTemplate(templateName: string, context: any): string {
    const templatePath = path.join(
      __dirname,
      'templates',
      `${templateName}.hbs`,
    );
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);
    return template(context);
  }

  async sendUserConfirmation(user: User, token: string) {
    const url = `${process.env.APP_URL}?verifyToken=${token}`;
    const logoUrl = `${process.env.APP_URL}/logo-email.png`;

    const html = this.compileTemplate('confirmation', {
      url,
      name: user.fullName,
      email: user.email,
      logoUrl,
    });

    await this.resend.emails.send({
      from: `GearVN <${process.env.MAIL_FROM}>`,
      to: user.email,
      subject: 'Chào mừng đến với GearVN! Xác minh địa chỉ email của bạn',
      html,
    });
  }

  async sendResetPassword(user: User, token: string) {
    const url = `${process.env.APP_URL}?resetToken=${token}`;
    const logoUrl = `${process.env.APP_URL}/logo-email.png`;

    const html = this.compileTemplate('reset-password', {
      url,
      name: user.fullName,
      email: user.email,
      logoUrl,
    });

    await this.resend.emails.send({
      from: `GearVN <${process.env.MAIL_FROM}>`,
      to: user.email,
      subject: 'Đặt lại mật khẩu của bạn',
      html,
    });
  }
}
