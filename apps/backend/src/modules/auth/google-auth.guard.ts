import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(): {
    session: false;
    prompt: 'select_account';
  } {
    return {
      session: false,
      prompt: 'select_account',
    };
  }
}
