import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { Request as ERequest } from 'express';

import { CurrentUser } from './decorators/current-user.decorator';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() request: ERequest) {
    return this.authService.register(dto, this.getRequestMetadata(request));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() request: ERequest) {
    return this.authService.login(dto, this.getRequestMetadata(request));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.logout(user.userId, user.sessionId);
  }

  private getRequestMetadata(request: ERequest): {
    ipAddress?: string;
    userAgent?: string;
  } {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
    };
  }
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() request: { user: AuthenticatedUser }) {
    return this.authService.me(request.user.userId);
  }
}
