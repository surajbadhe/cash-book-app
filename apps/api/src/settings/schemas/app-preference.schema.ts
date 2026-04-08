import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class AppPreference extends Document {
  @Prop({ required: true, unique: true })
  businessId: string;

  @Prop({ default: 'INR' })
  currency: string;

  @Prop({ default: 'Asia/Kolkata' })
  timezone: string;

  @Prop({ default: 0 })
  defaultOpeningCash: number;

  @Prop({ default: false })
  allowNegativeCash: boolean;

  @Prop({ default: false })
  lowCashAlertEnabled: boolean;

  @Prop()
  dailyReminderTime?: string;
}

export const AppPreferenceSchema = SchemaFactory.createForClass(AppPreference);
