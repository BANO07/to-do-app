import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { ApolloTestingModule } from 'apollo-angular/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ApolloTestingModule, HttpClientTestingModule],
      providers: [AuthService],
    });
    service = TestBed.inject(AuthService);
  });

  it('should start unauthenticated', () => {
    expect(service.currentUser).toBeNull();
  });

  it('should redirect to backend google auth endpoint', () => {
    const originalLocation = window.location;
    delete (window as { location?: Location }).location;
    window.location = { href: '' } as Location;

    service.loginWithGoogle();
    expect(window.location.href).toContain('/auth/google');

    window.location = originalLocation;
  });
});
