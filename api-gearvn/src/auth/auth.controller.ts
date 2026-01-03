import {
  Get,
  Post,
  Body,
  Query,
  Request,
  Response,
  UseGuards,
  Controller,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

import { JwtGuard } from './guards/jwt.guard';
import { LocalGuard } from './guards/local.guard';
import { RefreshJwtGuard } from './guards/refresh-jwt.guard';
import { GoogleOauthGuard } from './guards/google-oauth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @UseGuards(LocalGuard)
  @ApiBody({ type: LoginDto })
  login(@Request() req) {
    return this.authService.login(req.user.id);
  }

  @Post('register')
  @ApiBody({ type: RegisterDto })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('google/login')
  @UseGuards(GoogleOauthGuard)
  googleLogin() {}

  @Get('google/callback')
  @UseGuards(GoogleOauthGuard)
  async googleCallback(@Request() req, @Response() res) {
    const { accessToken, refreshToken } = await this.authService.login(
      req.user._id,
    );
    res.redirect(
      `${process.env.APP_URL}/api/auth/google/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`,
    );
  }

  @Get('verify')
  @ApiQuery({ name: 'token', required: true, type: String })
  async verify(@Query('token') token: string) {
    return this.authService.verify(token);
  }

  @Post('forgot-password')
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('refresh')
  @UseGuards(RefreshJwtGuard)
  @ApiBearerAuth()
  refreshToken(@Request() req) {
    return this.authService.refreshToken(req.user.id);
  }

  @Post('logout')
  @UseGuards(JwtGuard)
  logout(@Request() req) {
    return this.authService.logout(req.user.id);
  }
}
