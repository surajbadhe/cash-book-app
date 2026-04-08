import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserService } from '../user/user.service';
import { AuthProvider, User, UserRole } from '../user/schemas/user.schema';
import { RefreshToken } from '../user/schemas/refresh-token.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    @InjectModel(User.name)
    private userModel: Model<User>,
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshToken>,
  ) {}

  /**
   * Register a new user with email and password
   */
  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.userService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create new user
    const user = await this.userService.create({
      email: registerDto.email,
      password: registerDto.password,
      provider: AuthProvider.LOCAL,
      roles: [UserRole.USER],
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.roles);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
      },
    };
  }

  /**
   * Login with email and password
   */
  async login(loginDto: LoginDto) {
    const user = await this.userService.findByEmail(loginDto.email);
    
    if (!user || user.provider !== AuthProvider.LOCAL) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.userService.validatePassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.roles);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
      },
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(userId: string, refreshToken: string) {
    const storedToken = await this.refreshTokenModel.findOne({
      userId,
      token: refreshToken,
      isRevoked: false,
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > storedToken.expiresAt) {
      await this.refreshTokenModel.deleteOne({ _id: storedToken._id });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Get user and generate new tokens
    const user = await this.userService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.roles);
    
    // Revoke old token and store new one (token rotation)
    await this.refreshTokenModel.deleteOne({ _id: storedToken._id });
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(userId: string, refreshToken: string) {
    await this.refreshTokenModel.deleteOne({
      userId,
      token: refreshToken,
    });
    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Request password reset token
   */
  async requestPasswordReset(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userModel.findOne({ email: normalizedEmail }).exec();

    if (user && user.provider === AuthProvider.LOCAL && user.isActive) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();

      const clientUrl = this.configService.get<string>('cors.origin');
      const resetUrl = `${clientUrl}/forgot-password?token=${rawToken}`;
      await this.emailService.sendPasswordResetEmail(normalizedEmail, resetUrl);
    }

    return {
      message:
        'If an account with that email exists, a reset link has been sent.',
    };
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, password: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userModel
      .findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() },
      })
      .exec();

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (user.provider !== AuthProvider.LOCAL) {
      throw new BadRequestException(
        `This account uses ${user.provider} sign-in. Use that provider to log in.`,
      );
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    await this.refreshTokenModel.deleteMany({ userId: user.id });

    return { message: 'Password reset successful' };
  }

  /**
   * OAuth login (Google/GitHub)
   */
  async oauthLogin(profile: any, provider: AuthProvider) {
    const email = profile.emails?.[0]?.value || profile.email;
    
    if (!email) {
      throw new BadRequestException('Email not provided by OAuth provider');
    }

    let user = await this.userService.findByProvider(provider, profile.id);

    if (!user) {
      // Check if user exists with the same email
      user = await this.userService.findByEmail(email);

      // Allow linking OAuth to existing local account by email
      if (user) {
        if (user.provider !== provider && user.provider !== AuthProvider.LOCAL) {
          throw new ConflictException(
            `Email already registered with ${user.provider} provider`,
          );
        }

        // Save providerId for future OAuth lookups when missing
        if (!user.providerId) {
          user = await this.userService.update(user.id, {
            providerId: profile.id,
          });
        }
      }

      // Create new user
      if (!user) {
        user = await this.userService.create({
          email,
          provider,
          providerId: profile.id,
          roles: [UserRole.USER],
          isActive: true,
        });
      }
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.roles);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
      },
    };
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(userId: string, email: string, roles: string[]) {
    const payload = { sub: userId, email, roles };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.accessTokenExpiry'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.refreshTokenExpiry'),
    });

    return { accessToken, refreshToken };
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(userId: string, token: string) {
    const expiresIn = this.configService.get<string>('jwt.refreshTokenExpiry');
    const expiresAt = new Date();
    
    // Convert expiry string to milliseconds
    const match = expiresIn.match(/(\d+)([smhd])/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
      expiresAt.setTime(expiresAt.getTime() + value * multipliers[unit]);
    }

    await this.refreshTokenModel.create({
      userId,
      token,
      expiresAt,
    });
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUser(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return user;
  }
  /**
   * Validate OAuth login for Google/GitHub strategies
   */
  async validateOAuthLogin(user: any, provider: AuthProvider) {
    // Find or create user using oauthLogin logic
    const oauthUser = await this.oauthLogin({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      emails: [{ value: user.email }],
    }, provider);
    return oauthUser;
  }
}
