import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map, catchError, of } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import {
  User,
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  AuthResponse,
  ApiResponse,
  UserRole,
} from '../models/auth.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private accessTokenSubject = new BehaviorSubject<string | null>(null);
  public accessToken$ = this.accessTokenSubject.asObservable();

  constructor() {
    // Try to restore user session on app init
    this.restoreSession();
  }

  /**
   * Get current user value
   */
  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Get access token value
   */
  get accessToken(): string | null {
    return this.accessTokenSubject.value;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.currentUser && !!this.accessToken;
  }

  /**
   * Check if user has specific role
   */
  hasRole(role: UserRole): boolean {
    return this.currentUser?.roles?.includes(role) ?? false;
  }

  /**
   * Register new user
   */
  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/register`, data, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          if (response.success) {
            this.setSession(response.data.accessToken, this.normalizeUser(response.data.user));
          }
        })
      );
  }

  /**
   * Login with email and password
   */
  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, data, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
          if (response.success) {
            this.setSession(response.data.accessToken, this.normalizeUser(response.data.user));
          }
        })
      );
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<ApiResponse<null>> {
    return this.http.post<ApiResponse<null>>(`${this.apiUrl}/forgot-password`, data, {
      withCredentials: true,
    });
  }

  resetPassword(data: ResetPasswordRequest): Observable<ApiResponse<null>> {
    return this.http.post<ApiResponse<null>>(`${this.apiUrl}/reset-password`, data, {
      withCredentials: true,
    });
  }

  /**
   * Logout user
   */
  logout(): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => {
          this.clearSession();
          this.router.navigate(['/login']);
        }),
        catchError(() => {
          // Even if API call fails, clear local session
          this.clearSession();
          this.router.navigate(['/login']);
          return of(null);
        })
      );
  }

  /**
   * Clear local session and redirect to login without making API calls
   */
  expireSession(redirectToLogin = true): void {
    this.clearSession();
    if (redirectToLogin) {
      this.router.navigate(['/login']);
    }
  }

  /**
   * Refresh access token
   */
  refreshToken(): Observable<{ accessToken: string } | null> {
    return this.http
      .post<ApiResponse<{ accessToken: string }>>(
        `${this.apiUrl}/refresh`,
        {},
        { withCredentials: true }
      )
      .pipe(
        map((response) => {
          if (response.success && response.data.accessToken) {
            this.accessTokenSubject.next(response.data.accessToken);
            localStorage.setItem('accessToken', response.data.accessToken);
            return { accessToken: response.data.accessToken };
          }
          return null;
        }),
        catchError(() => {
          this.clearSession();
          return of(null);
        })
      );
  }

  /**
   * Get current user from API
   */
  getCurrentUser(): Observable<User | null> {
    return this.http
      .get<ApiResponse<User>>(`${this.apiUrl}/me`, {
        withCredentials: true,
      })
      .pipe(
        map((response) => {
          if (response.success && response.data) {
            const normalizedUser = this.normalizeUser(response.data as User & { sub?: string });
            this.currentUserSubject.next(normalizedUser);
            localStorage.setItem('user', JSON.stringify(normalizedUser));
            return normalizedUser;
          }
          return null;
        }),
        catchError(() => {
          return of(null);
        })
      );
  }

  /**
   * OAuth login (Google/GitHub)
   */
  loginWithOAuth(provider: 'google' | 'github'): void {
    window.location.href = environment.oauth[`${provider}Url`];
  }

  /**
   * Handle OAuth callback
   */
  handleOAuthCallback(token: string): void {
    this.accessTokenSubject.next(token);
    localStorage.setItem('accessToken', token);
    
    // Fetch user details
    this.getCurrentUser().subscribe({
      next: () => {
        const inviteToken = localStorage.getItem('pendingInviteToken');
        if (inviteToken) {
          localStorage.removeItem('pendingInviteToken');
          this.router.navigate(['/invite/accept'], {
            queryParams: { token: inviteToken },
          });
          return;
        }

        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.clearSession();
        this.router.navigate(['/login'], {
          queryParams: { error: 'Authentication failed. Please try again.' },
        });
      },
    });
  }

  /**
   * Set user session
   */
  private setSession(accessToken: string, user: User): void {
    this.accessTokenSubject.next(accessToken);
    this.currentUserSubject.next(user);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
  }

  private normalizeUser(user: User & { sub?: string }): User {
    return {
      ...user,
      id: user.id || user.sub || '',
    };
  }

  /**
   * Clear user session
   */
  private clearSession(): void {
    this.accessTokenSubject.next(null);
    this.currentUserSubject.next(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('currentBusinessId');
  }

  /**
   * Restore session from localStorage
   */
  private restoreSession(): void {
    const token = localStorage.getItem('accessToken');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.accessTokenSubject.next(token);
        this.currentUserSubject.next(this.normalizeUser(user));
        
        // Verify session is still valid
        this.getCurrentUser().subscribe();
      } catch (error) {
        this.clearSession();
      }
    }
  }
}
