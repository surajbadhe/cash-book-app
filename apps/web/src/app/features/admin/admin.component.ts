import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import { UserRole, User } from '../../core/models/auth.models';
import { ErrorLog } from '../../core/models/admin.models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="admin-container">
      <nav class="navbar">
        <div class="nav-content">
          <h2>Admin Panel</h2>
          <div class="nav-actions">
            <button class="btn btn-outline" (click)="logout()">Logout</button>
          </div>
        </div>
      </nav>

      <main class="main-content">
        <div class="grid">
          <section class="card">
            <div class="card-header">
              <div>
                <p class="eyebrow">User Management</p>
                <h3>Users</h3>
              </div>
              <span class="badge">{{ users.length }} users</span>
            </div>

            <div class="table" *ngIf="!loadingUsers; else loadingUsersTpl">
              <div class="table-head">
                <span>Email</span>
                <span>Provider</span>
                <span>Roles</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              <div class="table-row" *ngFor="let u of users">
                <span>{{ u.email }}</span>
                <span class="muted">{{ u.provider || 'local' }}</span>
                <span class="roles">
                  <span class="badge" *ngFor="let r of u.roles">{{ r }}</span>
                </span>
                <span>
                  <span class="status" [class.inactive]="u.isActive === false">
                    {{ u.isActive === false ? 'Inactive' : 'Active' }}
                  </span>
                </span>
                <span class="actions">
                  <button class="chip" (click)="toggleRole(u, userRoles.ADMIN)">
                    {{ u.roles.includes(userRoles.ADMIN) ? 'Revoke admin' : 'Make admin' }}
                  </button>
                  <button class="chip" (click)="toggleActive(u)">
                    {{ u.isActive === false ? 'Activate' : 'Deactivate' }}
                  </button>
                </span>
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-header">
              <div>
                <p class="eyebrow">System</p>
                <h3>Error Logs</h3>
              </div>
              <span class="badge">Latest {{ logs.length }}</span>
            </div>

            <div class="logs" *ngIf="!loadingLogs; else loadingLogsTpl">
              <div class="log" *ngFor="let log of logs">
                <div class="log-header">
                  <span class="log-level">{{ log.level }}</span>
                  <span class="muted">{{ log.createdAt | date:'short' }}</span>
                </div>
                <div class="log-message">{{ log.message }}</div>
                <div class="log-meta">
                  <span *ngIf="log.status">Status: {{ log.status }}</span>
                  <span *ngIf="log.method">{{ log.method }}</span>
                  <span *ngIf="log.url">{{ log.url }}</span>
                </div>
                <pre class="log-stack" *ngIf="log.stack">{{ log.stack }}</pre>
              </div>
            </div>
          </section>
        </div>

        <ng-template #loadingUsersTpl>
          <div class="loading">Loading users...</div>
        </ng-template>
        <ng-template #loadingLogsTpl>
          <div class="loading">Loading logs...</div>
        </ng-template>
      </main>
    </div>
  `,
  styles: [`
    /* Dashboard import removed */

    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      gap: 12px;
    }

    .badge {
      padding: 6px 10px;
      background: #eef2ff;
      color: #4338ca;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }

    .table {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }

    .table-head, .table-row {
      display: grid;
      grid-template-columns: 1.3fr 0.9fr 1fr 0.7fr 1.2fr;
      gap: 12px;
      padding: 12px 16px;
      align-items: center;
    }

    .table-head {
      background: #f8fafc;
      font-weight: 700;
      color: #475569;
      font-size: 13px;
    }

    .table-row {
      border-top: 1px solid #e2e8f0;
      font-size: 14px;
    }

    .muted { color: #94a3b8; }

    .roles { display: flex; gap: 6px; flex-wrap: wrap; }

    .status {
      padding: 4px 8px;
      border-radius: 8px;
      background: #ecfdf3;
      color: #166534;
      font-weight: 600;
      font-size: 12px;
    }

    .status.inactive { background: #fef2f2; color: #991b1b; }

    .actions { display: flex; gap: 8px; flex-wrap: wrap; }

    .chip {
      border: 1px solid #cbd5e1;
      background: #fff;
      padding: 6px 10px;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 600;
      font-size: 12px;
      color: #0f172a;
      transition: background 0.15s ease, border-color 0.15s ease;
    }

    .chip:hover { background: #f8fafc; border-color: #94a3b8; }

    .logs { display: flex; flex-direction: column; gap: 12px; }

    .log {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
      background: #f8fafc;
    }

    .log-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      color: #475569;
    }

    .log-level {
      font-weight: 700;
      color: #b91c1c;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .log-message { margin: 6px 0; font-weight: 600; color: #0f172a; }

    .log-meta { display: flex; gap: 10px; flex-wrap: wrap; color: #475569; font-size: 12px; }

    .log-stack {
      margin: 8px 0 0;
      background: #0f172a;
      color: #e2e8f0;
      padding: 10px;
      border-radius: 8px;
      font-size: 12px;
      white-space: pre-wrap;
    }

    .loading { padding: 12px; color: #475569; }
  `],
})
export class AdminComponent implements OnInit {
  users: User[] = [];
  logs: ErrorLog[] = [];
  userRoles = UserRole;
  loadingUsers = false;
  loadingLogs = false;

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.fetchUsers();
    this.fetchLogs();
  }

  fetchUsers(): void {
    this.loadingUsers = true;
    this.adminService.getUsers().subscribe({
      next: (users) => (this.users = users || []),
      error: () => {},
      complete: () => (this.loadingUsers = false),
    });
  }

  fetchLogs(): void {
    this.loadingLogs = true;
    this.adminService.getErrorLogs(50).subscribe({
      next: (logs) => (this.logs = logs || []),
      error: () => {},
      complete: () => (this.loadingLogs = false),
    });
  }

  toggleRole(user: User, role: UserRole): void {
    const roles = user.roles?.includes(role)
      ? user.roles.filter((r) => r !== role)
      : [...(user.roles || []), role];

    this.adminService.updateUser(user.id, { roles }).subscribe((u) => {
      this.users = this.users.map((item) => (item.id === u.id ? u : item));
    });
  }

  toggleActive(user: User): void {
    const isActive = user.isActive === false;
    this.adminService.updateUser(user.id, { isActive }).subscribe((u) => {
      this.users = this.users.map((item) => (item.id === u.id ? u : item));
    });
  }

  logout(): void {
    this.authService.logout().subscribe();
  }

  // goToDashboard removed
}
