import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { Category, CategorySchema } from '../category/schemas/category.schema';
import { Transaction, TransactionSchema } from '../transaction/schemas/transaction.schema';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { BusinessInvite, BusinessInviteSchema } from './schemas/business-invite.schema';
import { Business, BusinessSchema } from './schemas/business.schema';

@Module({
  imports: [
    AuthModule,
    UserModule,
    MongooseModule.forFeature([
      { name: Business.name, schema: BusinessSchema },
      { name: BusinessInvite.name, schema: BusinessInviteSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [BusinessController],
  providers: [BusinessService],
  exports: [BusinessService, MongooseModule],
})
export class BusinessModule {}
