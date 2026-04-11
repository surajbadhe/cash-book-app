import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { CategoryType } from '../../category/schemas/category.schema';

export enum TransactionSource {
  MANUAL = 'manual',
  SYNC = 'sync',
}

@Schema({ timestamps: true })
export class Transaction extends Document {
  @Prop({ required: true, index: true })
  businessId: string;

  @Prop({ type: String, enum: CategoryType, required: true })
  type: CategoryType;

  @Prop({ required: true, min: 0.01 })
  amount: number;

  @Prop({ required: true })
  categoryId: string;

  @Prop({ required: true })
  categoryName: string;

  @Prop({ required: true })
  occurredAt: Date;

  @Prop()
  note?: string;

  @Prop()
  party?: string;

  @Prop()
  mode?: string;

  @Prop()
  entryBy?: string;

  @Prop({ type: String, enum: TransactionSource, default: TransactionSource.MANUAL })
  source: TransactionSource;

  @Prop()
  deviceId?: string;

  @Prop()
  localRef?: string;

  @Prop({ required: true })
  createdBy: string;

  @Prop()
  updatedBy?: string;

  @Prop({ default: null })
  deletedAt?: Date | null;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ businessId: 1, occurredAt: -1 });
TransactionSchema.index({ businessId: 1, type: 1, occurredAt: -1 });
TransactionSchema.index({ businessId: 1, categoryId: 1, occurredAt: -1 });
TransactionSchema.index(
  { businessId: 1, deviceId: 1, localRef: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deviceId: { $type: 'string', $ne: '' },
      localRef: { $type: 'string', $ne: '' },
    },
  },
);
