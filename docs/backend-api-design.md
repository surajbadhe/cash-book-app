# cash-flow backend API design

## Goals

Design a backend API for restaurant owners and small businesses to:
- record `cash-in` and `cash-out` transactions
- manage expense and income categories
- close the business day with a summary snapshot
- view daily, weekly, monthly, profit/loss, and category-wise expense reports
- support offline-first mobile/PWA clients with later synchronization
- keep the API simple and fast for non-technical users

This design follows the existing NestJS conventions in this repo:
- base path: `/api`
- auth: JWT bearer + refresh cookie
- response wrapper:

```json
{
  "success": true,
  "message": "Human readable message",
  "data": {}
}
```

---

## Recommended domain model

### 1. Business
Represents one restaurant or small business workspace.

```ts
Business {
  id: string;
  ownerId: string;
  name: string;
  type: 'restaurant' | 'retail' | 'general';
  currency: string;        // e.g. INR, USD
  timezone: string;        // e.g. Asia/Kolkata
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2. Category
Used for classifying income and expenses.

```ts
Category {
  id: string;
  businessId: string;
  name: string;
  type: 'cash-in' | 'cash-out';
  color?: string;
  icon?: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
```

### 3. Transaction
Core ledger item.

```ts
Transaction {
  id: string;
  businessId: string;
  type: 'cash-in' | 'cash-out';
  amount: number;
  categoryId: string;
  categoryName: string;      // denormalized for faster reports
  occurredAt: string;
  note?: string;
  source: 'manual' | 'sync';
  deviceId?: string;
  localRef?: string;         // client-generated id for offline sync
  createdBy: string;
  updatedBy?: string;
  deletedAt?: string | null; // soft delete for sync safety
  createdAt: string;
  updatedAt: string;
}
```

### 4. DailyClosing
Snapshot of business cash state at the end of a day.

```ts
DailyClosing {
  id: string;
  businessId: string;
  businessDate: string;      // yyyy-mm-dd in business timezone
  openingCash: number;
  totalCashIn: number;
  totalCashOut: number;
  expectedCash: number;
  actualCash: number;
  variance: number;
  note?: string;
  closedBy: string;
  closedAt: string;
  createdAt: string;
  updatedAt: string;
}
```

### 5. UserBusinessRole
Supports future staff access.

```ts
UserBusinessRole {
  id: string;
  userId: string;
  businessId: string;
  role: 'owner' | 'manager' | 'cashier' | 'viewer';
}
```

### 6. AppPreference
Server-side settings that should roam across devices.

```ts
AppPreference {
  id: string;
  businessId: string;
  lowCashAlertEnabled: boolean;
  dailyReminderTime?: string;
  defaultOpeningCash?: number;
  allowNegativeCash: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## Roles and access

### Owner
- full access to business settings, categories, transactions, reports, closings, sync

### Manager
- create/update transactions
- run reports
- create daily closing
- limited category management

### Cashier
- create transactions
- view same-day history
- no business settings

### Viewer
- read-only reports

For MVP, owner-only is enough. The schema should still be built to support role expansion.

---

## API modules

Recommended NestJS modules:
- `business`
- `category`
- `transaction`
- `closing`
- `report`
- `settings`
- `sync`

Auth and user modules already exist.

---

## Endpoint design

## 1. Business APIs

### POST `/api/businesses`
Create the first business after signup.

Request:
```json
{
  "name": "Spice Route Cafe",
  "type": "restaurant",
  "currency": "INR",
  "timezone": "Asia/Kolkata",
  "phone": "+91-9999999999",
  "address": "Pune"
}
```

Response:
```json
{
  "success": true,
  "message": "Business created successfully",
  "data": {
    "id": "biz_001",
    "name": "Spice Route Cafe",
    "type": "restaurant",
    "currency": "INR",
    "timezone": "Asia/Kolkata"
  }
}
```

### GET `/api/businesses/me`
Get current user business.

### PATCH `/api/businesses/:businessId`
Update business profile.

---

## 2. Category APIs

### GET `/api/categories?type=cash-out&active=true`
List categories for the current business.

### POST `/api/categories`
Create category.

Request:
```json
{
  "name": "Inventory",
  "type": "cash-out",
  "color": "#ef4444",
  "icon": "package",
  "sortOrder": 1
}
```

### PATCH `/api/categories/:id`
Update category.

### DELETE `/api/categories/:id`
Soft delete category if unused, or mark inactive.

### POST `/api/categories/seed-defaults`
Create default restaurant categories.

Default `cash-in`:
- Food Sales
- Beverage Sales
- Online Orders
- Catering
- Other Income

Default `cash-out`:
- Inventory
- Utilities
- Rent
- Staff Wages
- Maintenance
- Transport
- Marketing
- Other Expense

---

## 3. Transaction APIs

### GET `/api/transactions`
List transactions with filters.

Query params:
- `from`
- `to`
- `type`
- `categoryId`
- `search`
- `page`
- `limit`
- `sortBy=occurredAt`
- `sortOrder=desc`

Example:
`GET /api/transactions?from=2026-04-01&to=2026-04-07&type=cash-out&page=1&limit=20`

Response:
```json
{
  "success": true,
  "message": "Transactions retrieved successfully",
  "data": {
    "items": [],
    "page": 1,
    "limit": 20,
    "total": 125,
    "summary": {
      "totalIn": 25000,
      "totalOut": 8700,
      "net": 16300
    }
  }
}
```

### POST `/api/transactions`
Create one transaction.

Request:
```json
{
  "type": "cash-in",
  "amount": 1450,
  "categoryId": "cat_food_sales",
  "occurredAt": "2026-04-07T13:30:00.000Z",
  "note": "Lunch rush",
  "deviceId": "device-123",
  "localRef": "local-txn-1"
}
```

### GET `/api/transactions/:id`
Get transaction details.

### PATCH `/api/transactions/:id`
Update transaction.

### DELETE `/api/transactions/:id`
Soft delete a transaction.

### POST `/api/transactions/bulk`
Create multiple transactions in one call.
Useful for offline sync and very fast entry.

Request:
```json
{
  "items": [
    {
      "type": "cash-in",
      "amount": 1200,
      "categoryId": "cat_food_sales",
      "occurredAt": "2026-04-07T08:00:00.000Z",
      "localRef": "mob-1"
    },
    {
      "type": "cash-out",
      "amount": 300,
      "categoryId": "cat_transport",
      "occurredAt": "2026-04-07T09:00:00.000Z",
      "localRef": "mob-2"
    }
  ]
}
```

### GET `/api/transactions/summary/daily?date=2026-04-07`
Fast daily closing summary without full report payload.

Response:
```json
{
  "success": true,
  "message": "Daily summary retrieved successfully",
  "data": {
    "date": "2026-04-07",
    "totalIn": 14500,
    "totalOut": 4200,
    "net": 10300,
    "cashInCount": 24,
    "cashOutCount": 9
  }
}
```

---

## 4. Daily closing APIs

### POST `/api/closings`
Close a business day.

Request:
```json
{
  "businessDate": "2026-04-07",
  "openingCash": 5000,
  "actualCash": 15320,
  "note": "Two pending supplier bills paid in cash"
}
```

Server computes:
- `totalCashIn`
- `totalCashOut`
- `expectedCash`
- `variance`

### GET `/api/closings?from=2026-04-01&to=2026-04-30`
List closing records.

### GET `/api/closings/:id`
Get one closing record.

### GET `/api/closings/by-date/:businessDate`
Get closing for a given day.

### PATCH `/api/closings/:id/reopen`
Reopen a daily close for correction.
Restricted to owner/manager.

---

## 5. Reporting APIs

These endpoints should return compact, mobile-friendly payloads.

### GET `/api/reports/daily?date=2026-04-07`
Detailed daily report.

Response:
```json
{
  "success": true,
  "message": "Daily report retrieved successfully",
  "data": {
    "date": "2026-04-07",
    "summary": {
      "totalIn": 14500,
      "totalOut": 4200,
      "net": 10300
    },
    "byCategory": [
      { "category": "Food Sales", "amount": 11000 },
      { "category": "Beverage Sales", "amount": 3500 }
    ],
    "expenseCategories": [
      { "category": "Inventory", "amount": 2500 },
      { "category": "Transport", "amount": 300 }
    ]
  }
}
```

### GET `/api/reports/weekly?startDate=2026-04-07`
Weekly totals for 7-day range.

### GET `/api/reports/monthly?year=2026&month=4`
Monthly totals + day-wise trend.

Suggested payload:
```json
{
  "summary": {
    "totalIn": 220000,
    "totalOut": 91000,
    "net": 129000
  },
  "dailyTrend": [
    { "date": "2026-04-01", "cashIn": 8200, "cashOut": 2100, "net": 6100 }
  ]
}
```

### GET `/api/reports/profit-loss?from=2026-04-01&to=2026-04-30`
Profit and loss overview for arbitrary period.

### GET `/api/reports/expenses-by-category?from=2026-04-01&to=2026-04-30`
Category-wise expense analysis.

Response:
```json
{
  "success": true,
  "message": "Expense analysis retrieved successfully",
  "data": {
    "totalExpense": 91000,
    "items": [
      {
        "categoryId": "cat_inventory",
        "category": "Inventory",
        "amount": 42000,
        "percentage": 46.15
      }
    ]
  }
}
```

### GET `/api/reports/dashboard?date=2026-04-07`
Single compact endpoint for the mobile dashboard.

Suggested payload:
```json
{
  "success": true,
  "message": "Dashboard report retrieved successfully",
  "data": {
    "daily": {},
    "weekly": {},
    "monthly": {},
    "profitLoss": {},
    "expenseCategories": []
  }
}
```

This endpoint is recommended for the current Angular dashboard.

---

## 6. Settings APIs

### GET `/api/settings`
Get business app settings.

### PATCH `/api/settings`
Update settings.

Request:
```json
{
  "currency": "INR",
  "timezone": "Asia/Kolkata",
  "defaultOpeningCash": 5000,
  "allowNegativeCash": false,
  "lowCashAlertEnabled": true,
  "dailyReminderTime": "22:00"
}
```

Note:
- local app lock PIN should remain device-local for best security and offline support
- backend settings should store only cross-device preferences, not the local unlock PIN

---

## 7. Offline sync APIs

Offline support is a key product requirement. The API should support conflict-safe synchronization.

## Sync strategy

Client stores transactions locally first.
When online:
1. push local changes
2. pull server changes since last sync token
3. reconcile using `updatedAt` and `localRef`

### POST `/api/sync/push`
Push offline-created or offline-edited records.

Request:
```json
{
  "deviceId": "device-123",
  "lastKnownServerTime": "2026-04-07T10:00:00.000Z",
  "transactions": {
    "created": [],
    "updated": [],
    "deleted": []
  },
  "categories": {
    "created": [],
    "updated": [],
    "deleted": []
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Sync push completed",
  "data": {
    "accepted": {
      "transactions": [],
      "categories": []
    },
    "conflicts": [],
    "serverTime": "2026-04-07T10:05:00.000Z"
  }
}
```

### GET `/api/sync/pull?since=2026-04-07T10:00:00.000Z`
Fetch server-side changes after last sync.

Response:
```json
{
  "success": true,
  "message": "Sync pull completed",
  "data": {
    "transactions": [],
    "categories": [],
    "closings": [],
    "settings": {},
    "serverTime": "2026-04-07T10:05:00.000Z"
  }
}
```

### GET `/api/sync/bootstrap`
Return all initial data for first device login.

Payload should include:
- business
- categories
- last 30 to 90 days transactions
- latest closings
- settings

---

## Validation rules

### Transaction
- `amount > 0`
- `occurredAt` required
- `categoryId` required
- `type` must match category type
- do not allow posting into a permanently locked/closed date unless reopened

### Daily closing
- one closing per `businessId + businessDate`
- `actualCash >= 0` unless `allowNegativeCash = true`

### Category
- unique per `businessId + type + normalizedName`

---

## Indexing recommendations

### Transaction indexes
- `{ businessId: 1, occurredAt: -1 }`
- `{ businessId: 1, type: 1, occurredAt: -1 }`
- `{ businessId: 1, categoryId: 1, occurredAt: -1 }`
- `{ businessId: 1, localRef: 1, deviceId: 1 }` unique sparse
- `{ businessId: 1, updatedAt: -1 }`

### DailyClosing indexes
- `{ businessId: 1, businessDate: 1 }` unique

### Category indexes
- `{ businessId: 1, type: 1, name: 1 }`

---

## Suggested NestJS DTOs

Recommended DTO files:
- `business/dto/create-business.dto.ts`
- `business/dto/update-business.dto.ts`
- `category/dto/create-category.dto.ts`
- `category/dto/update-category.dto.ts`
- `transaction/dto/create-transaction.dto.ts`
- `transaction/dto/update-transaction.dto.ts`
- `transaction/dto/list-transactions.dto.ts`
- `transaction/dto/bulk-upsert-transactions.dto.ts`
- `closing/dto/create-closing.dto.ts`
- `report/dto/date-range-report.dto.ts`
- `report/dto/daily-report.dto.ts`
- `settings/dto/update-settings.dto.ts`
- `sync/dto/push-sync.dto.ts`

---

## Suggested implementation order

### Phase 1 - MVP
1. `business`
2. `category`
3. `transaction`
4. `report`
5. `settings`

### Phase 2
6. `closing`
7. `sync`
8. staff roles per business

---

## Recommended MVP endpoints to build first

1. `POST /api/businesses`
2. `GET /api/businesses/me`
3. `GET /api/categories`
4. `POST /api/categories/seed-defaults`
5. `POST /api/transactions`
6. `GET /api/transactions`
7. `PATCH /api/transactions/:id`
8. `DELETE /api/transactions/:id`
9. `GET /api/reports/dashboard`
10. `GET /api/reports/expenses-by-category`
11. `GET /api/settings`
12. `PATCH /api/settings`

This gives the current frontend enough server APIs for migration from local-only storage to synced storage.
