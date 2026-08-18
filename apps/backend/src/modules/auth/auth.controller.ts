import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google-auth.guard';
import { User } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(GoogleAuthGuard)
  googleAuth(): void {
    // Redirect handled by Passport
  }

  @Get('google/callback')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Req() req: Request, @Res() res: Response): void {
    const user = req.user as User;
    const token = this.authService.signToken(user);
    this.authService.setAuthCookie(res, token);
    this.authService.redirectToApp(res);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): { success: boolean } {
    this.authService.clearAuthCookie(res);
    return { success: true };
  }

  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  status(@Req() req: Request): { authenticated: boolean; user: User } {
    return { authenticated: true, user: req.user as User };
  }
}
