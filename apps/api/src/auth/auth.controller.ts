import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Response,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiCookieAuth } from '@nestjs/swagger';
import { Response as ExpressResponse, Request as ExpressRequest } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthProvider } from '../user/schemas/user.schema';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const result = await this.authService.register(registerDto);
    
    // Set refresh token in httpOnly cookie
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      success: true,
      message: 'User registered successfully',
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    };
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const result = await this.authService.login(loginDto);
    
    // Set refresh token in httpOnly cookie
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      success: true,
      message: 'Login successful',
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiCookieAuth('refreshToken')
  @UseGuards(RefreshTokenGuard)
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @CurrentUser() user: any,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const result = await this.authService.refreshTokens(
      user.sub,
      user.refreshToken,
    );
    
    // Set new refresh token in httpOnly cookie
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: result.accessToken,
      },
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: any,
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    
    if (refreshToken) {
      await this.authService.logout(user.sub, refreshToken);
    }
    
    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    return {
      success: true,
      message: 'Logged out successfully',
      data: null,
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: any) {
    return {
      success: true,
      message: 'User retrieved successfully',
      data: user,
    };
  }

  // Google OAuth
  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Google OAuth login' })
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth flow
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Request() req: any,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    try {
      // req.user is already the tokens object set by GoogleStrategy
      const result = req.user;

      if (!result?.accessToken) {
        throw new Error('OAuth login failed: no token returned from strategy');
      }

      // Set refresh token in httpOnly cookie
      this.setRefreshTokenCookie(res, result.refreshToken);

      // Redirect to frontend with access token
      const clientUrl = this.configService.get<string>('cors.origin');
      res.redirect(`${clientUrl}/auth/callback?token=${result.accessToken}`);
      return;
    } catch (error: any) {
      const clientUrl = this.configService.get<string>('cors.origin');
      const message = encodeURIComponent(error?.message || 'OAuth login failed');
      res.redirect(`${clientUrl}/auth/callback?error=${message}`);
      return;
    }
  }

  /**
   * Helper method to set refresh token cookie
   */
  private setRefreshTokenCookie(res: ExpressResponse, refreshToken: string) {
    const cookieOptions = this.configService.get('cookies');
    res.cookie('refreshToken', refreshToken, cookieOptions);
  }
}
