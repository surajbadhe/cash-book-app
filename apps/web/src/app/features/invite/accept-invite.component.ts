import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BusinessContextService } from '../../core/services/business-context.service';
import { CashflowApiService } from '../../core/services/cashflow-api.service';
import { BusinessInvitePreview } from '../../core/models/cashflow-api.models';

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe],
  template: `
    <div class="invite-page">
      <div class="invite-card">
        <h1>Shop Invitation</h1>

        @if (loading) {
          <p class="muted">Loading invitation…</p>
        } @else if (errorMessage) {
          <p class="error">{{ errorMessage }}</p>
        } @else if (invite) {
          <p>You were invited to join <strong>{{ invite.businessName }}</strong> as <strong>{{ invite.role | titlecase }}</strong>.</p>
          <p class="muted">Invite email: {{ invite.email }}</p>
          <p class="muted">Expires: {{ invite.expiresAt | date:'medium' }}</p>

          @if (!isAuthenticated) {
            <div class="actions">
              <button type="button" class="btn" (click)="goToLogin()">Login to Accept</button>
              <button type="button" class="btn secondary" (click)="goToRegister()">Create Account</button>
            </div>
          } @else {
            @if (emailMismatch) {
              <p class="error">You are logged in as a different email. Please login with {{ invite.email }}.</p>
            } @else {
              <div class="actions">
                <button type="button" class="btn" [disabled]="accepting" (click)="acceptInvite()">
                  {{ accepting ? 'Accepting…' : 'Accept Invite' }}
                </button>
              </div>
            }
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .invite-page { min-height: 100dvh; display:flex; align-items:center; justify-content:center; background:#f1f5f9; padding:16px; }
    .invite-card { width:100%; max-width:520px; background:#fff; border-radius:16px; padding:24px; box-shadow:0 10px 30px rgba(15,23,42,0.1); }
    h1 { margin:0 0 12px; font-size:24px; color:#0f172a; }
    p { margin:8px 0; color:#334155; }
    .muted { color:#64748b; font-size:13px; }
    .error { color:#dc2626; font-weight:500; }
    .actions { margin-top:16px; display:flex; gap:10px; flex-wrap:wrap; }
    .btn { border:none; background:#4f46e5; color:#fff; border-radius:10px; padding:10px 14px; font-weight:600; cursor:pointer; }
    .btn.secondary { background:#e2e8f0; color:#334155; }
    .btn[disabled] { opacity:0.65; cursor:not-allowed; }
  `],
})
export class AcceptInviteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly api = inject(CashflowApiService);
  private readonly businessContext = inject(BusinessContextService);

  loading = true;
  accepting = false;
  errorMessage = '';
  token = '';
  invite: BusinessInvitePreview | null = null;

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  get emailMismatch(): boolean {
    const currentEmail = this.authService.currentUser?.email?.toLowerCase();
    return !!this.invite?.email && !!currentEmail && this.invite.email.toLowerCase() !== currentEmail;
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.errorMessage = 'Invite token is missing.';
      this.loading = false;
      return;
    }

    this.api.getInvitePreview(this.token).subscribe({
      next: (preview) => {
        this.invite = preview;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Invite is invalid or expired.';
        this.loading = false;
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login'], { queryParams: { inviteToken: this.token } });
  }

  goToRegister(): void {
    this.router.navigate(['/register'], { queryParams: { inviteToken: this.token } });
  }

  acceptInvite(): void {
    if (!this.token || !this.isAuthenticated) {
      return;
    }

    this.accepting = true;
    this.errorMessage = '';

    this.api.acceptBusinessInvite(this.token).subscribe({
      next: (result) => {
        this.businessContext.refreshBusinesses().subscribe({
          next: (businesses) => {
            const selected = businesses.find((item) => item.id === result.businessId);
            if (selected) {
              this.businessContext.setCurrentBusiness(selected);
            }
            this.router.navigate(['/dashboard']);
          },
          error: () => {
            this.router.navigate(['/dashboard']);
          },
        });
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Failed to accept invite.';
        this.accepting = false;
      },
    });
  }
}
