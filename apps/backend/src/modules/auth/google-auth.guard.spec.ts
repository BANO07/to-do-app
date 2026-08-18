import { GoogleAuthGuard } from './google-auth.guard';

describe('GoogleAuthGuard', () => {
  it('requests Google account selection on authentication', () => {
    const guard = new GoogleAuthGuard();

    expect(guard.getAuthenticateOptions()).toEqual({
      session: false,
      prompt: 'select_account',
    });
  });
});
