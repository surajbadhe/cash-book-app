import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpHandlerFn,
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

/**
 * HTTP Interceptor to attach JWT token and handle 401 errors
 * Using functional interceptor (Angular 17+)
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  const authService = inject(AuthService);
  const isAuthRequest = req.url.includes('/auth/');

  // Clone request and add Authorization header if token exists
  const token = authService.accessToken;
  if (token) {
    req = addTokenToRequest(req, token);
  }

  // Always include credentials (for httpOnly cookies)
  req = req.clone({
    withCredentials: true,
  });

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle 401 Unauthorized errors
      if (
        error.status === 401 &&
        !req.url.includes('/auth/refresh') &&
        !isAuthRequest
      ) {
        return handle401Error(req, next, authService);
      }

      return throwError(() => error);
    })
  );
};

/**
 * Add JWT token to request headers
 */
function addTokenToRequest(
  request: HttpRequest<any>,
  token: string
): HttpRequest<any> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Handle 401 errors by refreshing the token
 */
function handle401Error(
  request: HttpRequest<any>,
  next: HttpHandlerFn,
  authService: AuthService
): Observable<HttpEvent<any>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((result) => {
        isRefreshing = false;
        if (result && result.accessToken) {
          refreshTokenSubject.next(result.accessToken);
          return next(addTokenToRequest(request, result.accessToken));
        }

        // Refresh failed, clear local session without extra API calls
        authService.expireSession();
        return throwError(() => new Error('Session expired'));
      }),
      catchError((error) => {
        isRefreshing = false;
        authService.expireSession();
        return throwError(() => error);
      })
    );
  }

  // Wait for token refresh to complete
  return refreshTokenSubject.pipe(
    filter((token) => token !== null),
    take(1),
    switchMap((token) => next(addTokenToRequest(request, token!)))
  );
}
