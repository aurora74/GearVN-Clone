import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Inject, Injectable } from '@nestjs/common';

import { VerifiedCallback } from 'passport-jwt';
import { Strategy } from 'passport-google-oauth20';

import { AuthService } from '../auth.service';
import { AccountStatus } from '../enums/account-status.enum';
import googleOauthConfig from '../config/google-oauth.config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(googleOauthConfig.KEY)
    private googleConfiguration: ConfigType<typeof googleOauthConfig>,
    private authService: AuthService,
  ) {
    super({
      clientID: googleConfiguration.clientID!,
      clientSecret: googleConfiguration.clientSecret!,
      callbackURL: googleConfiguration.callbackURL!,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifiedCallback,
  ) {
    const user = await this.authService.validateGoogleUser({
      email: profile.emails[0].value,
      fullName: profile.name.familyName
        ? `${profile.name.familyName} ${profile.name.givenName}`
        : profile.name.givenName,
      avatarUrl: profile.photos[0].value,
      status: AccountStatus.VERIFIED,
    });

    done(null, user);
  }
}
