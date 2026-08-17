import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of, map } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import { environment } from '../../../environments/environment';
import { User } from '../models/app.models';
import { ME_QUERY } from '../graphql/operations';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apollo = inject(Apollo);
  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);

  readonly currentUser$ = this.currentUserSubject.asObservable();

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  loginWithGoogle(): void {
    window.location.href = `${environment.apiUrl}/auth/google`;
  }

  loadCurrentUser(): Observable<User | null> {
    return this.apollo
      .query<{ me: User | null }>({
        query: ME_QUERY,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map(({ data }) => {
          this.currentUserSubject.next(data.me);
          return data.me;
        }),
        catchError(() => {
          this.currentUserSubject.next(null);
          return of(null);
        }),
      );
  }

  logout(): Observable<{ success: boolean }> {
    return this.http
      .post<{ success: boolean }>(
        `${environment.apiUrl}/auth/logout`,
        {},
        { withCredentials: true },
      )
      .pipe(
        tap(() => {
          this.currentUserSubject.next(null);
          this.apollo.client.clearStore();
        }),
      );
  }
}
