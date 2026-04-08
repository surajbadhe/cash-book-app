import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BusinessModule } from '../business/business.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AppPreference, AppPreferenceSchema } from './schemas/app-preference.schema';

@Module({
  imports: [
    BusinessModule,
    MongooseModule.forFeature([{ name: AppPreference.name, schema: AppPreferenceSchema }]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
