import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthService } from './auth.service';
import { UserService } from 'src/user/user.service';
import { MailService } from 'src/mail/mail.service';

import jwtConfig from 'src/auth/config/jwt.config';
import emailJwtConfig from './config/email-jwt.config';
import googleOauthConfig from './config/google-oauth.config';
import refreshJwtConfig from 'src/auth/config/refresh-jwt.config';

import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { RefreshJwtStrategy } from './strategies/refresh-jwt.strategy';

import { AuthController } from './auth.controller';
import { User, UserSchema } from 'src/user/user.schema';

import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  imports: [
    CloudinaryModule,
    ConfigModule.forFeature(jwtConfig),
    ConfigModule.forFeature(emailJwtConfig),
    ConfigModule.forFeature(refreshJwtConfig),
    ConfigModule.forFeature(googleOauthConfig),
    JwtModule.registerAsync(jwtConfig.asProvider()),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [AuthController],
  providers: [
    MailService,
    AuthService,
    UserService,
    JwtStrategy,
    LocalStrategy,
    GoogleStrategy,
    RefreshJwtStrategy,
  ],
})
export class AuthModule {}
