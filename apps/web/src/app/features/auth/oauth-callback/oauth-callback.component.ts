import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  template: `
    <div class="callback-container" [class.error]="!!error()">
      <div class="card">
        @if (!error()) {
          <div class="spinner"></div>
          <p>Completing authentication...</p>
        } @else {
          <h3>Authentication failed</h3>
          <p class="error-text">{{ error() }}</p>
          <button class="btn" (click)="goToLogin()">Back to login</button>
        }
      </div>
    </div>
  `,
  styles: [`
    .callback-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
      padding: 16px;
      color: #e2e8f0;
    }

    .card {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 16px;
      padding: 32px;
      width: 100%;
      max-width: 420px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(8px);
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(148, 163, 184, 0.4);
      border-top-color: #60a5fa;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    h3 {
      margin: 0 0 12px;
      color: #f8fafc;
    }

    p {
      margin: 0;
      color: #cbd5e1;
    }

    .error-text {
      color: #fca5a5;
      margin-bottom: 16px;
      white-space: pre-line;
    }

    .btn {
      margin-top: 8px;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      border: none;
      color: #fff;
      padding: 10px 16px;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 600;
      width: 100%;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 30px rgba(124, 58, 237, 0.25);
    }
  `],
})
export class OAuthCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private router = inject(Router);

  error = signal<string | null>(null);

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const token = params['token'];
      const error = params['error'];
      const shop = params['book'] || params['shop'] || this.authService.getPendingShopId();

      if (shop) {
        this.authService.setPendingShopId(shop);
      }

      if (error) {
        this.error.set(decodeURIComponent(error));
        return;
      }

      if (token) {
        this.authService.handleOAuthCallback(token, shop);
      } else {
        this.router.navigate(['/login'], {
          queryParams: shop ? { book: shop } : undefined,
        });
      }
    });
  }

  goToLogin(): void {
    const shop = this.authService.getPendingShopId();
    this.router.navigate(['/login'], {
      queryParams: shop ? { book: shop } : undefined,
    });
  }
}
