import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum BusinessType {
  RESTAURANT = 'restaurant',
  RETAIL = 'retail',
  GENERAL = 'general',
}

export enum BusinessMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export class BusinessMember {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, enum: BusinessMemberRole, default: BusinessMemberRole.EDITOR })
  role: BusinessMemberRole;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: Date.now })
  joinedAt: Date;
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

  @Prop({ type: [BusinessMember], default: [] })
  members: BusinessMember[];

  @Prop({ default: true })
  isActive: boolean;
}

export const BusinessSchema = SchemaFactory.createForClass(Business);
BusinessSchema.index({ ownerId: 1 });
BusinessSchema.index({ 'members.userId': 1, isActive: 1 });
