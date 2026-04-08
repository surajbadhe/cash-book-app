import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './business/business.module';
import { CategoryModule } from './category/category.module';
import { TransactionModule } from './transaction/transaction.module';
import { ReportModule } from './report/report.module';
import { SettingsModule } from './settings/settings.module';
import { UserModule } from './user/user.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import {
  ErrorLog,
  ErrorLogSchema,
} from './common/schemas/error-log.schema';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LogsController } from './common/controllers/logs.controller';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../../.env'],
    }),

    // Database
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
      inject: [ConfigService],
    }),

    // Error logs collection
    MongooseModule.forFeature([{ name: ErrorLog.name, schema: ErrorLogSchema }]),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('security.rateLimitTtl') * 1000,
          limit: configService.get<number>('security.rateLimitMax'),
        },
      ],
      inject: [ConfigService],
    }),

    // Logging
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                },
              }
            : undefined,
        level: process.env.LOG_LEVEL || 'info',
      },
    }),

    // Feature Modules
    AuthModule,
    BusinessModule,
    CategoryModule,
    TransactionModule,
    ReportModule,
    SettingsModule,
    UserModule,
  ],
  controllers: [AppController, LogsController],
  providers: [AppService, HttpExceptionFilter],
})
export class AppModule {}
