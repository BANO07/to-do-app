import {
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google-auth.guard';
import { User } from '../users/entities/user.entity';
import { CalendarConnectionService } from '../calendar/calendar-connection.service';
import { CalendarSyncService } from '../calendar/calendar-sync.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly calendarConnectionService: CalendarConnectionService,
    private readonly calendarSyncService: CalendarSyncService,
    private readonly configService: ConfigService,
  ) {}

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

  /**
   * Initiate Google Calendar OAuth — requires JWT auth (user must be logged in).
   * Redirects user to Google consent screen with calendar.readonly scope.
   */
  @Get('calendar')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard('jwt'))
  calendarConnect(@Req() req: Request, @Res() res: Response): void {
    const user = req.user as User;
    // State: base64(userId:timestamp) for basic CSRF protection
    const state = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    const url = this.calendarConnectionService.getAuthUrl(state);
    res.redirect(url);
  }

  /**
   * Handle Google Calendar OAuth callback.
   * Exchanges code for tokens, stores encrypted, redirects to frontend.
   */
  @Get('calendar/callback')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard('jwt'))
  async calendarCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ): Promise<void> {
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');

    if (error) {
      this.logger.warn(`[Calendar] OAuth error: ${error}`);
      res.redirect(`${frontendUrl}/calendar?error=access_denied`);
      return;
    }

    if (!code || !state) {
      res.redirect(`${frontendUrl}/calendar?error=invalid_callback`);
      return;
    }

    const user = req.user as User;

    // Validate state — basic check: state must contain the userId
    try {
      const decoded = Buffer.from(state, 'base64').toString('utf8');
      const [stateUserId] = decoded.split(':');
      if (stateUserId !== user.id) {
        throw new UnauthorizedException('State mismatch');
      }
    } catch {
      this.logger.warn(`[Calendar] State validation failed for userId=${user.id}`);
      res.redirect(`${frontendUrl}/calendar?error=invalid_state`);
      return;
    }

    try {
      await this.calendarConnectionService.connect(user.id, code);
      // Kick off initial sync (fire-and-forget)
      void this.calendarSyncService.syncForUser(user.id);
      res.redirect(`${frontendUrl}/calendar?connected=true`);
    } catch (err) {
      this.logger.error(
        `[Calendar] Connect failed for userId=${user.id}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      res.redirect(`${frontendUrl}/calendar?error=connect_failed`);
    }
  }
}
