import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { PreferencesService } from '../services/preferences.service';

const redirectAuthenticated = (): void => {
  const router = inject(Router);
  const prefs = inject(PreferencesService);
  void router.navigateByUrl(prefs.defaultLandingPath);
};

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.currentUser) {
    return true;
  }

  return authService.loadCurrentUser().pipe(
    map((user) => {
      if (user) {
        return true;
      }
      router.navigate(['/login']);
      return false;
    }),
    catchError(() => {
      router.navigate(['/login']);
      return of(false);
    }),
  );
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);

  if (authService.currentUser) {
    redirectAuthenticated();
    return false;
  }

  return authService.loadCurrentUser().pipe(
    map((user) => {
      if (user) {
        redirectAuthenticated();
        return false;
      }
      return true;
    }),
    catchError(() => of(true)),
  );
};
