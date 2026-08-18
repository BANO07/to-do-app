import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';
import { UsersService } from '../users/users.service';
import { CategoriesService } from '../categories/categories.service';
import { User } from '../users/entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly categoriesService: CategoriesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): Promise<User> {
    const user = await this.usersService.upsertFromGoogle(profile);
    await this.categoriesService.seedDefaultsForUser(user.id);
    return user;
  }

  signToken(user: User): string {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload);
  }

  setAuthCookie(res: Response, token: string): void {
    res.cookie('access_token', token, this.authCookieOptions());
  }

  clearAuthCookie(res: Response): void {
    res.clearCookie('access_token', this.authCookieOptions());
  }

  /**
   * Commit the session cookie on a 200 document, then send the browser to the SPA.
   * A 302 bounce off the API host is dropped by Chrome bounce-tracking / third-party
   * cookie rules, so GraphQL `me` would run without `access_token`.
   */
  redirectToApp(res: Response): void {
    const destination = `${this.frontendOrigin()}/dashboard`;
    const safeHref = escapeHtml(destination);

    res.status(200).type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0.2;url=${safeHref}" />
    <title>Signing in</title>
  </head>
  <body>
    <p>Signing you in…</p>
    <p><a href="${safeHref}">Continue</a></p>
  </body>
</html>`);
  }

  private authCookieOptions(): CookieOptions {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const crossSite = this.isCrossSite();
    const sameSite: CookieOptions['sameSite'] =
      crossSite || isProduction ? 'none' : 'lax';

    return {
      httpOnly: true,
      secure: sameSite === 'none' || isProduction,
      sameSite,
      maxAge: this.cookieMaxAgeMs(),
      path: '/',
    };
  }

  private isCrossSite(): boolean {
    try {
      const frontend = new URL(this.frontendOrigin());
      const backend = new URL(
        this.configService.getOrThrow<string>('BACKEND_URL'),
      );
      return (
        frontend.protocol !== backend.protocol ||
        frontend.hostname !== backend.hostname
      );
    } catch {
      return true;
    }
  }

  private frontendOrigin(): string {
    return this.configService
      .getOrThrow<string>('FRONTEND_URL')
      .replace(/\/$/, '');
  }

  private cookieMaxAgeMs(): number {
    const expires = this.configService.get<string>('JWT_EXPIRES_IN') ?? '7d';
    const match = /^(\d+)d$/.exec(expires);
    if (match) {
      return Number(match[1]) * 24 * 60 * 60 * 1000;
    }
    return 7 * 24 * 60 * 60 * 1000;
  }

  async getUserFromPayload(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid session');
    }
    return user;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
