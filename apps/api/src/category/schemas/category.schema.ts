import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum CategoryType {
  CASH_IN = 'cash-in',
  CASH_OUT = 'cash-out',
}

@Schema({ timestamps: true })
export class Category extends Document {
  @Prop({ required: true, index: true })
  businessId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: CategoryType, required: true })
  type: CategoryType;

  @Prop()
  color?: string;

  @Prop()
  icon?: string;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sortOrder: number;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.index({ businessId: 1, type: 1, name: 1 }, { unique: true });
