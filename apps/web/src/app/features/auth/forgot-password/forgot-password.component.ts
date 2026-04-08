import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

const passwordMatchValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (!password || !confirmPassword) {
    return null;
  }

  return password === confirmPassword ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../login/login.component.scss'],
})
export class ForgotPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  token: string | null = null;
  loading = false;
  errorMessage = '';
  successMessage = '';

  requestForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  resetForm = this.fb.group(
    {
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(6),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator },
  );

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
  }

  submitRequest(): void {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const email = this.requestForm.controls.email.value?.trim() || '';

    this.authService.forgotPassword({ email }).subscribe({
      next: (response) => {
        this.successMessage =
          response.message ||
          'If an account exists, a reset link has been sent to your email.';
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to send reset link. Please try again.';
      },
      complete: () => {
        this.loading = false;
      },
    });
  }

  submitReset(): void {
    if (!this.token) {
      this.errorMessage = 'Invalid reset token.';
      return;
    }

    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const password = this.resetForm.controls.password.value || '';

    this.authService.resetPassword({
      token: this.token,
      password,
    }).subscribe({
      next: (response) => {
        this.successMessage = response.message || 'Password has been reset successfully.';
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1200);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to reset password. Please try again.';
      },
      complete: () => {
        this.loading = false;
      },
    });
  }
}
