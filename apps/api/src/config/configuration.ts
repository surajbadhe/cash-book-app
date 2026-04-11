export default () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cash-flow',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '6h',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '14d',
  },
  
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback',
    },
  },
  
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
    rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL, 10) || 60,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 10,
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true,
  },
  
  cookies: {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'strict') as 'none' | 'strict',
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
  },

  email: {
    connectionString: process.env.ACS_EMAIL_CONNECTION_STRING || '',
    senderAddress: process.env.ACS_EMAIL_SENDER_ADDRESS || '',
  },
  };
};
