import { registerAs } from '@nestjs/config';
import { JwtSignOptions } from '@nestjs/jwt';

export default registerAs(
  'email-jwt',
  (): JwtSignOptions => ({
    secret: process.env.EMAIL_JWT_SECRET_KEY,
    expiresIn: process.env.EMAIL_JWT_EXPIRE_IN,
  }),
);
