import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loginForm: FormGroup;
  loading = false;
  errorMessage = '';
  inviteToken = '';
  shopId = '';

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });

    this.inviteToken = this.route.snapshot.queryParamMap.get('inviteToken') || this.authService.getPendingInviteToken();
    if (this.inviteToken) {
      this.authService.setPendingInviteToken(this.inviteToken);
    }

    this.shopId = this.route.snapshot.queryParamMap.get('book') || this.route.snapshot.queryParamMap.get('shop') || this.authService.getPendingShopId();
    if (this.shopId) {
      this.authService.setPendingShopId(this.shopId);
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        const inviteToken = this.inviteToken || this.authService.getPendingInviteToken();
        const shopId = this.shopId || this.authService.getPendingShopId();
        if (inviteToken) {
          this.router.navigate(['/invite/accept'], {
            queryParams: {
              token: inviteToken,
              ...(shopId ? { book: shopId } : {}),
            },
          });
        } else {
          this.router.navigate(['/transactions'], {
            queryParams: shopId ? { book: shopId } : undefined,
          });
        }
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Login failed. Please try again.';
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      },
    });
  }

  loginWithGoogle(): void {
    if (this.inviteToken) {
      this.authService.setPendingInviteToken(this.inviteToken);
    }
    if (this.shopId) {
      this.authService.setPendingShopId(this.shopId);
    }
    this.authService.loginWithOAuth('google');
  }
}
