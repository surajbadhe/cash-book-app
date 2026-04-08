import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BusinessService } from '../business/business.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AppPreference } from './schemas/app-preference.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(AppPreference.name) private readonly preferenceModel: Model<AppPreference>,
    private readonly businessService: BusinessService,
  ) {}

  async getForCurrentUser(userId: string): Promise<AppPreference> {
    const business = await this.businessService.findByOwnerId(userId);
    return this.findOrCreateDefaults(business.id, business.currency, business.timezone);
  }

  async updateForCurrentUser(userId: string, dto: UpdateSettingsDto): Promise<AppPreference> {
    const business = await this.businessService.findByOwnerId(userId);
    const preferences = await this.findOrCreateDefaults(business.id, business.currency, business.timezone);

    Object.assign(preferences, dto);
    await preferences.save();

    if (dto.currency || dto.timezone) {
      await this.businessService.update(userId, business.id, {
        currency: dto.currency ?? business.currency,
        timezone: dto.timezone ?? business.timezone,
      });
    }

    return preferences;
  }

  private async findOrCreateDefaults(
    businessId: string,
    currency: string,
    timezone: string,
  ): Promise<AppPreference> {
    let preferences = await this.preferenceModel.findOne({ businessId }).exec();
    if (!preferences) {
      preferences = await this.preferenceModel.create({
        businessId,
        currency,
        timezone,
        defaultOpeningCash: 0,
        allowNegativeCash: false,
        lowCashAlertEnabled: false,
      });
    }
    return preferences;
  }
}
