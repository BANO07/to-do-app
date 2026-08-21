import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { CalendarConnectionRepository } from './calendar-connection.repository';
import { CalendarConnection } from './entities/calendar-connection.entity';
import { CalendarConnectionStatus } from '../../common/enums/calendar-connection-status.enum';
import { CalendarConnectionStatus as CalendarConnStatusDto } from './dto/calendar.dto';
import {
  GOOGLE_CALENDAR_OAUTH_SCOPES,
  hasGoogleCalendarWriteScope,
} from './google-calendar-scopes';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

@Injectable()
export class CalendarConnectionService {
  private readonly logger = new Logger(CalendarConnectionService.name);
  private readonly encryptionKey: Buffer;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private readonly connectionRepo: CalendarConnectionRepository,
    private readonly configService: ConfigService,
  ) {
    const rawKey = this.configService.get<string>('CALENDAR_TOKEN_ENCRYPTION_KEY');
    // Use a 32-byte key: pad/truncate from env or derive from JWT_SECRET
    const source = rawKey ?? this.configService.getOrThrow<string>('JWT_SECRET');
    this.encryptionKey = Buffer.from(source.padEnd(32, '0').slice(0, 32), 'utf8');

    this.clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const backendUrl = this.configService.getOrThrow<string>('BACKEND_URL');
    this.redirectUri = `${backendUrl}/auth/calendar/callback`;
  }

  /** Build the Google OAuth2 URL for calendar access */
  getAuthUrl(stateToken: string): string {
    const scopes = [...GOOGLE_CALENDAR_OAUTH_SCOPES];
    const client = this.createOAuth2Client();
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: stateToken,
      prompt: 'consent',
      include_granted_scopes: true,
    });
  }

  /** Exchange authorization code for tokens and store connection */
  async connect(
    userId: string,
    code: string,
  ): Promise<{ providerAccountId: string | null }> {
    const client = this.createOAuth2Client();

    let tokens: {
      access_token?: string | null;
      refresh_token?: string | null;
      expiry_date?: number | null;
      scope?: string;
    };
    let providerAccountId: string | null = null;

    try {
      const { tokens: t } = await client.getToken(code);
      tokens = t;
    } catch (err) {
      this.logger.warn(
        `[Calendar] Token exchange failed for userId=${userId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new UnauthorizedException('Failed to connect Google Calendar.');
    }

    if (!tokens.access_token) {
      throw new UnauthorizedException('No access token received from Google.');
    }

    // Credentials are used below; providerAccountId fetched from tokeninfo

    // Get user email via tokeninfo
    try {
      const res = await fetch(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${tokens.access_token}`,
      );
      if (res.ok) {
        const info = await res.json() as { email?: string };
        providerAccountId = info.email ?? null;
      }
    } catch {
      // Non-fatal
    }

    const encryptedAccess = this.encrypt(tokens.access_token);
    const encryptedRefresh = tokens.refresh_token
      ? this.encrypt(tokens.refresh_token)
      : null;
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : null;
    const scopes = tokens.scope ? tokens.scope.split(' ') : [];

    await this.connectionRepo.upsert({
      userId,
      provider: 'google',
      providerAccountId,
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      tokenExpiresAt: expiresAt,
      scopes,
      status: CalendarConnectionStatus.ACTIVE,
    });

    this.logger.log(`[Calendar] userId=${userId} connected account=${providerAccountId ?? 'unknown'}`);
    return { providerAccountId };
  }

  async disconnect(userId: string): Promise<void> {
    const conn = await this.connectionRepo.findByUserId(userId);
    if (conn) {
      // Best-effort revoke — don't fail the disconnect if this fails
      try {
        const accessToken = this.decrypt(conn.accessToken);
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`,
          { method: 'POST' },
        );
      } catch {
        // Non-fatal
      }
      await this.connectionRepo.delete(userId);
      this.logger.log(`[Calendar] userId=${userId} disconnected`);
    }
  }

  async getConnectionStatus(userId: string): Promise<CalendarConnStatusDto> {
    const conn = await this.connectionRepo.findByUserId(userId);
    if (!conn || conn.status !== CalendarConnectionStatus.ACTIVE) {
      return {
        connected: false,
        canWrite: false,
        needsReconnect: false,
      };
    }
    const canWrite = hasGoogleCalendarWriteScope(conn.scopes);
    return {
      connected: true,
      providerAccountId: conn.providerAccountId ?? undefined,
      connectedAt: conn.connectedAt,
      canWrite,
      // Connected with an older readonly grant — user must re-consent for Todo sync.
      needsReconnect: !canWrite,
    };
  }

  /**
   * Returns a decrypted, refreshed OAuth2Client ready to call Google APIs.
   * Updates stored tokens if refreshed.
   */
  async getReadyClient(userId: string): Promise<OAuth2Client | null> {
    const conn = await this.connectionRepo.findActiveByUserId(userId);
    if (!conn) return null;

    const client = this.createOAuth2Client();
    const accessToken = this.decrypt(conn.accessToken);
    const refreshToken = conn.refreshToken ? this.decrypt(conn.refreshToken) : null;

    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken ?? undefined,
      expiry_date: conn.tokenExpiresAt?.getTime() ?? undefined,
    });

    // Refresh if expired or expiring within 5 minutes
    const fiveMinutesMs = 5 * 60 * 1000;
    const expiresAt = conn.tokenExpiresAt?.getTime() ?? 0;
    const needsRefresh = !expiresAt || expiresAt - Date.now() < fiveMinutesMs;

    if (needsRefresh && refreshToken) {
      try {
        const { credentials } = await client.refreshAccessToken();
        const newAccess = credentials.access_token;
        const newExpiry = credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : null;
        if (newAccess) {
          await this.connectionRepo.updateTokens(
            conn.id,
            this.encrypt(newAccess),
            newExpiry,
          );
          this.logger.log(`[Calendar] userId=${userId} token refreshed`);
        }
      } catch (err) {
        this.logger.warn(
          `[Calendar] Token refresh failed for userId=${userId}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
        await this.connectionRepo.updateStatus(
          conn.id,
          CalendarConnectionStatus.EXPIRED,
        );
        return null;
      }
    }

    return client;
  }

  private createOAuth2Client(): OAuth2Client {
    return new OAuth2Client(this.clientId, this.clientSecret, this.redirectUri);
  }

  // AES-256-GCM encryption — IV + ciphertext + auth tag, base64-encoded
  private encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decrypt(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
