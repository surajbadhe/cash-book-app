import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum BusinessType {
  RESTAURANT = 'restaurant',
  RETAIL = 'retail',
  GENERAL = 'general',
}

@Schema({ timestamps: true })
export class Business extends Document {
  @Prop({ required: true })
  ownerId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: BusinessType, default: BusinessType.RESTAURANT })
  type: BusinessType;

  @Prop({ required: true, default: 'INR' })
  currency: string;

  @Prop({ required: true, default: 'Asia/Kolkata' })
  timezone: string;

  @Prop()
  phone?: string;

  @Prop()
  address?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const BusinessSchema = SchemaFactory.createForClass(Business);
BusinessSchema.index({ ownerId: 1 });
