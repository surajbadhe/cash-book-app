import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  registerForm: FormGroup;
  loading = false;
  errorMessage = '';
  inviteToken = '';
  shopId = '';

  constructor() {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required,
        Validators.minLength(6),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
      ]],
      confirmPassword: ['', [Validators.required]],
    }, {
      validators: this.passwordMatchValidator,
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

  passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const { email, password } = this.registerForm.value;

    this.authService.register({ email, password }).subscribe({
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
        this.errorMessage = error.error?.message || 'Registration failed. Please try again.';
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
