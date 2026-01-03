import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify } from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';

import { RegisterDto } from './dto/register.dto';

import { MailService } from 'src/mail/mail.service';
import { UserService } from 'src/user/user.service';

import { currentUser } from './types/current-user';
import { AuthJwtPayload } from './types/auth-jwt-payload';

import { UserRole } from './enums/user-role.enum';
import { AccountStatus } from './enums/account-status.enum';

import emailJwtConfig from './config/email-jwt.config';
import refreshJwtConfig from 'src/auth/config/refresh-jwt.config';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private mailService: MailService,
    private userService: UserService,

    @Inject(emailJwtConfig.KEY)
    private emailJwtConfiguration: ConfigType<typeof emailJwtConfig>,

    @Inject(refreshJwtConfig.KEY)
    private refreshJwtConfiguration: ConfigType<typeof refreshJwtConfig>,
  ) {}

  async login(userId: string) {
    const user = await this.userService.findOne(userId);

    if (!user) {
      throw new UnauthorizedException('User does not exist');
    }

    switch (user.status) {
      case AccountStatus.BANNED:
        throw new ForbiddenException('Your account has been banned');

      case AccountStatus.UNVERIFIED:
        const payload = { sub: user.id, email: user.email };
        const emailToken = await this.jwtService.signAsync(
          payload,
          this.emailJwtConfiguration,
        );
        await this.mailService.sendUserConfirmation(user, emailToken);
        throw new BadRequestException(
          'Account not verified. Please verify your email to continue',
        );

      case AccountStatus.VERIFIED:
        const { accessToken, refreshToken } = await this.generateTokens(userId);
        const hashedRefreshToken = await hash(refreshToken);
        await this.userService.updateRefreshToken(userId, hashedRefreshToken);
        return { id: userId, accessToken, refreshToken };

      default:
        throw new BadRequestException('Invalid account status');
    }
  }

  async register(data: RegisterDto) {
    const existingUser = await this.userService.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.userService.create(data);

    const payload = { sub: user.id, email: user.email };
    const emailToken = await this.jwtService.signAsync(
      payload,
      this.emailJwtConfiguration,
    );

    await this.mailService.sendUserConfirmation(user, emailToken);

    return user;
  }

  async verify(token: string) {
    const payload = await this.jwtService
      .verifyAsync(token, this.emailJwtConfiguration)
      .catch(() => {
        throw new UnauthorizedException('Invalid or expired token');
      });

    const user = await this.userService.findByEmail(payload.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userService.updateStatus(user.id, AccountStatus.VERIFIED);
  }

  async forgotPassword(email: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('This email is not registered in the system');
    }

    const payload = { sub: user.id, email: user.email };
    const token = await this.jwtService.signAsync(
      payload,
      this.emailJwtConfiguration,
    );

    await this.mailService.sendResetPassword(user, token);
  }

  async resetPassword(token: string, newPassword: string) {
    const payload = await this.jwtService
      .verifyAsync(token, this.emailJwtConfiguration)
      .catch(() => {
        throw new UnauthorizedException('Invalid or expired token');
      });

    const user = await this.userService.findOne(payload.sub);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await hash(newPassword);
    await this.userService.updatePassword(user.id, hashedPassword);
  }

  async refreshToken(userId: string) {
    const { accessToken, refreshToken } = await this.generateTokens(userId);

    const hashedRefreshToken = await hash(refreshToken);
    await this.userService.updateRefreshToken(userId, hashedRefreshToken);

    return { id: userId, accessToken, refreshToken };
  }

  async generateTokens(userId: string) {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload: AuthJwtPayload = {
      sub: user.id,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, this.refreshJwtConfiguration),
    ]);

    return { accessToken, refreshToken };
  }

  logout(userId: string) {
    return this.userService.updateRefreshToken(userId, null);
  }

  async validateUser(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordMatch = await verify(user.password!, password);
    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { id: user.id };
  }

  async validateRefreshToken(userId: string, refreshToken: string) {
    const user = await this.userService.findOne(userId);
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Invalid token');
    }

    const refreshTokenMatches = await verify(user.refreshToken, refreshToken);
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return { id: userId };
  }

  async validateJwtUser(userId: string) {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const currentUser: currentUser = { id: user.id, role: user.role };
    return currentUser;
  }

  async validateGoogleUser(googleUser: any) {
    const user = await this.userService.findByEmail(googleUser.email);
    if (user) {
      return user;
    }

    return await this.userService.create(googleUser);
  }
}
