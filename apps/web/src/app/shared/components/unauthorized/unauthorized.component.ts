import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="error-container">
      <div class="error-content">
        <h1>403</h1>
        <h2>Access Denied</h2>
        <p>You don't have permission to access this resource.</p>
        <a routerLink="/transactions" class="btn">Go to Transactions</a>
      </div>
    </div>
  `,
  styles: [`
    .error-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .error-content {
      text-align: center;
      color: white;

      h1 {
        font-size: 120px;
        margin: 0;
        font-weight: 700;
      }

      h2 {
        font-size: 32px;
        margin: 0 0 16px;
      }

      p {
        font-size: 18px;
        margin: 0 0 32px;
        opacity: 0.9;
      }

      .btn {
        display: inline-block;
        padding: 12px 32px;
        background: white;
        color: #667eea;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 600;
        transition: all 0.2s;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
      }
    }
  `],
})
export class UnauthorizedComponent {}
