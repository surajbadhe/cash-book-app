import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BusinessMemberRole } from './business.schema';

@Schema({ timestamps: true })
export class BusinessInvite extends Document {
  @Prop({ required: true, index: true })
  businessId: string;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ type: String, enum: BusinessMemberRole, default: BusinessMemberRole.EMPLOYEE })
  role: BusinessMemberRole;

  @Prop({ required: true })
  invitedByUserId: string;

  @Prop({ required: true, lowercase: true, trim: true })
  invitedByEmail: string;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: null })
  acceptedAt?: Date | null;

  @Prop({ default: null })
  acceptedByUserId?: string | null;

  @Prop({ default: null })
  cancelledAt?: Date | null;
}

export const BusinessInviteSchema = SchemaFactory.createForClass(BusinessInvite);
BusinessInviteSchema.index({ businessId: 1, email: 1, createdAt: -1 });
BusinessInviteSchema.index({ email: 1, acceptedAt: 1, cancelledAt: 1 });
