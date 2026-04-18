# 📊 Cash Flow – Personal Finance Management App

A modern, full-stack cash flow tracking application built to help users manage income, expenses, and financial insights with ease.

## ✨ Core Features

- **Transaction Management** – Record cash-in (income) and cash-out (expenses) transactions with categorization
- **Category Management** – Create, organize, and manage custom transaction categories directly from the UI
- **Dashboard** – Real-time overview of income, expenses, and net profit/loss
- **Advanced Reports** – Visual category-wise breakdowns for both income and expenses with period filters (daily, weekly, monthly)
- **Multi-Period Analytics** – Filter and compare financial data across different time periods
- **User Authentication** – Secure JWT-based auth with OAuth support (Google, GitHub)
- **Offline-First Sync** – Works seamlessly with local storage fallback; syncs to cloud when online
- **Business Multi-Tenancy** – Support for multiple business accounts per user
- **Responsive Design** – Fully optimized for desktop and mobile devices

## 🛠️ Tech Stack

**Frontend:**
- Angular 21 (standalone components, reactive forms)
- TypeScript, SCSS
- RxJS for reactive state management

**Backend:**
- NestJS (Node.js framework)
- MongoDB (Mongoose ODM)
- Class-validator for DTO validation
- JWT + Passport strategies for authentication

**Infrastructure:**
- Docker support (Dockerfile included for both apps)
- Docker Compose for local development
- pnpm workspaces for monorepo management

## 📁 Project Structure

```
├── apps/
│   ├── api/                    # NestJS Backend
│   │   ├── src/
│   │   │   ├── auth/          # Authentication module
│   │   │   │   ├── guards/    # JWT & Role guards
│   │   │   │   ├── strategies/ # Passport strategies
│   │   │   │   ├── decorators/ # Custom decorators
│   │   │   │   └── dto/       # Data transfer objects
│   │   │   ├── user/          # User module
│   │   │   │   └── schemas/   # Mongoose schemas
│   │   │   ├── common/        # Shared resources
│   │   │   │   ├── filters/   # Exception filters
│   │   │   │   ├── interceptors/ # HTTP interceptors
│   │   │   │   └── decorators/ # Custom decorators
│   │   │   ├── config/        # Configuration
│   │   │   └── main.ts        # Application entry point
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── web/                   # Angular Frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── core/      # Core module
│       │   │   │   ├── guards/ # Route guards
│       │   │   │   ├── interceptors/ # HTTP interceptors
│       │   │   │   ├── models/ # TypeScript interfaces
│       │   │   │   └── services/ # Core services
│       │   │   ├── features/  # Feature modules
│       │   │   │   ├── auth/  # Auth components
│       │   │   │   ├── dashboard/ # Dashboard
│       │   │   │   └── admin/ # Admin panel
│       │   │   ├── shared/    # Shared components
│       │   │   ├── app.routes.ts
│       │   │   └── app.config.ts
│       │   └── environments/  # Environment configs
│       ├── Dockerfile
│       ├── nginx.conf
│       └── package.json
│
├── docker-compose.yml
├── pnpm-workspace.yaml
├── .npmrc
├── .env.example
├── package.json
└── README.md
```

## 🛠️ Tech Stack

## 📘 Design Docs

- Backend API design: [docs/backend-api-design.md](docs/backend-api-design.md)

### Backend
- **Framework:** NestJS 10+
- **Database:** MongoDB 7
- **ODM:** Mongoose
- **Authentication:** Passport, JWT
- **Validation:** class-validator, class-transformer
- **Logging:** Pino
- **Documentation:** Swagger/OpenAPI
- **Security:** Helmet, bcrypt, rate-limiting

### Frontend
- **Framework:** Angular 21.1.4
- **Architecture:** Standalone Components
- **HTTP Client:** Angular HttpClient
- **Routing:** Angular Router
- **Forms:** Reactive Forms
- **State:** RxJS

### DevOps
- **Package Manager:** pnpm (with workspaces)
- **Containerization:** Docker
- **Orchestration:** Docker Compose
- **Web Server:** Nginx (for Angular)

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+ (Install with: `npm install -g pnpm`)
- Docker & Docker Compose
- MongoDB (if running locally)

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/AkashBadhe/cash-book-app.git
cd cash-flow

# Install pnpm globally if not already installed
npm install -g pnpm

# Install all dependencies using pnpm workspaces (recommended)
pnpm install -r

# Or install manually for each app
cd apps/api && pnpm install
cd ../web && pnpm install
```

### 2. Environment Configuration

```bash
# Copy environment example
cp .env.example .env

# Edit .env with your configuration
```

**Required Environment Variables:**

```env
# Server
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://admin:admin123@localhost:27017/cash-flow?authSource=admin
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=admin123
MONGO_DATABASE=cash-flow

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_ACCESS_EXPIRY=6h
JWT_REFRESH_EXPIRY=14d

# OAuth - Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# OAuth - GitHub
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

# Frontend
CLIENT_URL=http://localhost:4200

# Security
BCRYPT_ROUNDS=10
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=10
```

### 3. Run with Docker (Recommended)

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

**Services will be available at:**
- Frontend: http://localhost:4200
- Backend API: http://localhost:3000/api
- Swagger Docs: http://localhost:3000/api/docs
- MongoDB: localhost:27017

### 4. Run Locally (Development)

#### Backend
```bash
# From root using workspace commands
pnpm dev:api

# Or from the api directory
cd apps/api
pnpm install
pnpm run start:dev
```

#### Frontend
```bash
# From root using workspace commands
pnpm dev:web

# Or from the web directory
cd apps/web
pnpm install
pnpm start
```

#### Using Root Scripts

The root package.json provides convenient scripts for the entire monorepo:

```bash
# Install all dependencies
pnpm install:all

# Run both apps in development
pnpm dev:api    # Start backend
pnpm dev:web    # Start frontend

# Build everything
pnpm build:all

# Clean all node_modules and build artifacts
pnpm clean

# Docker commands
pnpm docker:up
pnpm docker:down
pnpm docker:build
pnpm docker:logs
```

## 🔐 OAuth Setup

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create new OAuth App
3. Set Authorization callback URL: `http://localhost:3000/api/auth/github/callback`
4. Copy Client ID and Client Secret to `.env`

## 📚 API Documentation

Once the backend is running, visit:
- **Swagger UI:** http://localhost:3000/api/docs

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/github` - GitHub OAuth login

#### Users
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user by ID
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## 🔒 Security Features

- ✅ Passwords hashed with bcrypt
- ✅ JWT tokens with expiration
- ✅ Refresh token rotation
- ✅ HttpOnly cookies for refresh tokens
- ✅ CORS protection
- ✅ Helmet security headers
- ✅ Rate limiting
- ✅ Input validation
- ✅ SQL injection prevention (NoSQL)
- ✅ XSS protection

## 👥 User Roles

The application supports role-based access control:

- **user** - Default role for all registered users
- **admin** - Administrative privileges

To create an admin user, update the user's roles in MongoDB:

```javascript
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { roles: ["user", "admin"] } }
)
```

## 🧪 Testing

```bash
# Backend unit tests
cd apps/api
pnpm run test

# Backend e2e tests
pnpm run test:e2e

# Frontend tests
cd apps/web
pnpm run test
```

## 📦 Build for Production

### Backend
```bash
cd apps/api
pnpm run build
```

### Frontend
```bash
cd apps/web
pnpm run build:prod
```

### Docker Production Build
```bash
docker-compose -f docker-compose.yml up --build
```

## � pnpm Workspace Commands

This project uses pnpm workspaces for efficient monorepo management. Here are useful commands:

```bash
# Install all dependencies in all workspaces
pnpm install -r

# Run a command in a specific workspace
pnpm --filter api start:dev
pnpm --filter web start

# Run a command in all workspaces
pnpm -r run build

# Add a dependency to a specific workspace
pnpm --filter api add express
pnpm --filter web add rxjs

# Add a dev dependency
pnpm --filter api add -D @types/node

# Update all dependencies
pnpm up -r

# Remove node_modules and reinstall
pnpm -r exec rm -rf node_modules && pnpm install -r
```

## �🔧 Customization

### Adding New Features

1. **Backend Module:**
```bash
cd apps/api
nest g module features/my-feature
nest g controller features/my-feature
nest g service features/my-feature
```

2. **Frontend Component:**
```bash
cd apps/web
ng g c features/my-feature --standalone
```

### Modifying Authentication

- JWT configuration: `apps/api/src/config/configuration.ts`
- Auth logic: `apps/api/src/auth/auth.service.ts`
- Frontend auth: `apps/web/src/app/core/services/auth.service.ts`

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running: `docker-compose ps`
- Check connection string in `.env`
- Verify MongoDB credentials

### OAuth Not Working
- Verify OAuth credentials in `.env`
- Check redirect URLs match OAuth app settings
- Ensure frontend URL is correct in backend config

### CORS Errors
- Verify `CLIENT_URL` in backend `.env`
- Check CORS configuration in `apps/api/src/main.ts`

## 📄 License

This project is open-source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions, please open an issue on GitHub.

## 👤 Author

**Akash Badhe**

---

**Built with ❤️ using NestJS and Angular**
