import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

import jwtConfig from '../auth/config/jwt.config';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthJwtPayload } from '../auth/types/auth-jwt-payload';
import { OwnershipActor } from '../auth/policy/ownership';

@Injectable()
export class ChatAuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
  ) {}

  private getTokenFromCookie(cookieHeader?: string | string[]) {
    const cookieValue = Array.isArray(cookieHeader)
      ? cookieHeader.join(';')
      : cookieHeader;

    return cookieValue
      ?.split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('accessToken='))
      ?.slice('accessToken='.length);
  }

  private getToken(socket: Socket): string | undefined {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const authorization = socket.handshake.headers.authorization;
    if (typeof authorization === 'string') {
      const [scheme, token] = authorization.split(' ');
      if (scheme?.toLowerCase() === 'bearer' && token) {
        return token;
      }
    }

    return this.getTokenFromCookie(socket.handshake.headers.cookie);
  }

  async authenticateSocket(socket: Socket): Promise<OwnershipActor> {
    const token = this.getToken(socket);
    if (!token) {
      throw new UnauthorizedException('Missing chat authentication token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthJwtPayload>(token, {
        secret: this.jwtConfiguration.secret!,
      });

      if (!payload.sub || !payload.role) {
        throw new UnauthorizedException('Invalid chat authentication token');
      }

      const actor = { id: payload.sub, role: payload.role as UserRole };
      socket.data.actor = actor;
      return actor;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid chat authentication token');
    }
  }
}
