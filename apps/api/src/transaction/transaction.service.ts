import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { BusinessService } from '../business/business.service';
import { CategoryService } from '../category/category.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { Transaction, TransactionSource } from './schemas/transaction.schema';

@Injectable()
export class TransactionService implements OnModuleInit {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectModel(Transaction.name) private readonly transactionModel: Model<Transaction>,
    private readonly businessService: BusinessService,
    private readonly categoryService: CategoryService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSyncReferenceIndex();
  }

  private async ensureSyncReferenceIndex(): Promise<void> {
    const indexName = 'businessId_1_deviceId_1_localRef_1';

    try {
      const indexes = await this.transactionModel.collection.indexes();
      const existing = indexes.find((index) => index.name === indexName);

      const isDesiredIndex =
        !!existing?.unique &&
        !!existing?.partialFilterExpression &&
        !existing?.sparse;

      if (existing && !isDesiredIndex) {
        await this.transactionModel.collection.dropIndex(indexName);
      }

      if (!isDesiredIndex) {
        await this.transactionModel.collection.createIndex(
          { businessId: 1, deviceId: 1, localRef: 1 },
          {
            name: indexName,
            unique: true,
            partialFilterExpression: {
              deviceId: { $type: 'string', $ne: '' },
              localRef: { $type: 'string', $ne: '' },
            },
          },
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to ensure transaction sync index: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async createForCurrentUser(userId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const business = await this.businessService.findByOwnerId(userId);
    const category = await this.categoryService.findByIdForBusiness(business.id, dto.categoryId);

    if (category.type !== dto.type) {
      throw new BadRequestException('Transaction type must match category type');
    }

    const normalizedDeviceId = dto.deviceId?.trim();
    const normalizedLocalRef = dto.localRef?.trim();

    const transaction = new this.transactionModel({
      businessId: business.id,
      type: dto.type,
      amount: dto.amount,
      categoryId: category.id,
      categoryName: category.name,
      occurredAt: new Date(dto.occurredAt),
      note: dto.note?.trim() || undefined,
      source: dto.source ?? TransactionSource.MANUAL,
      ...(normalizedDeviceId ? { deviceId: normalizedDeviceId } : {}),
      ...(normalizedLocalRef ? { localRef: normalizedLocalRef } : {}),
      createdBy: userId,
      updatedBy: userId,
      deletedAt: null,
    });

    return transaction.save();
  }

  async listForCurrentUser(userId: string, query: ListTransactionsDto) {
    const business = await this.businessService.findByOwnerId(userId);
    const filters: FilterQuery<Transaction> = {
      businessId: business.id,
      deletedAt: null,
    };

    if (query.type) {
      filters.type = query.type;
    }
    if (query.categoryId) {
      filters.categoryId = query.categoryId;
    }
    if (query.from || query.to) {
      filters.occurredAt = {};
      if (query.from) {
        filters.occurredAt.$gte = new Date(query.from);
      }
      if (query.to) {
        filters.occurredAt.$lte = new Date(`${query.to}T23:59:59.999Z`);
      }
    }
    if (query.search) {
      filters.$or = [
        { categoryName: { $regex: query.search, $options: 'i' } },
        { note: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'occurredAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, total, summaryRows] = await Promise.all([
      this.transactionModel
        .find(filters)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.transactionModel.countDocuments(filters).exec(),
      this.transactionModel.aggregate([
        { $match: filters },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const totalIn = summaryRows.find((row) => row._id === 'cash-in')?.total ?? 0;
    const totalOut = summaryRows.find((row) => row._id === 'cash-out')?.total ?? 0;

    return {
      items,
      page,
      limit,
      total,
      summary: {
        totalIn,
        totalOut,
        net: totalIn - totalOut,
      },
    };
  }

  async updateForCurrentUser(userId: string, id: string, dto: UpdateTransactionDto): Promise<Transaction> {
    const business = await this.businessService.findByOwnerId(userId);
    const transaction = await this.transactionModel.findById(id).exec();

    if (!transaction || transaction.deletedAt) {
      throw new NotFoundException('Transaction not found');
    }
    if (transaction.businessId !== business.id) {
      throw new ForbiddenException('You do not have access to this transaction');
    }

    if (dto.categoryId) {
      const category = await this.categoryService.findByIdForBusiness(business.id, dto.categoryId);
      const type = dto.type ?? transaction.type;
      if (category.type !== type) {
        throw new BadRequestException('Transaction type must match category type');
      }
      transaction.categoryId = category.id;
      transaction.categoryName = category.name;
    }

    if (dto.type) {
      transaction.type = dto.type;
    }
    if (typeof dto.amount === 'number') {
      transaction.amount = dto.amount;
    }
    if (dto.occurredAt) {
      transaction.occurredAt = new Date(dto.occurredAt);
    }
    if (typeof dto.note !== 'undefined') {
      transaction.note = dto.note;
    }
    if (dto.source) {
      transaction.source = dto.source;
    }
    if (dto.deviceId) {
      transaction.deviceId = dto.deviceId;
    }
    if (dto.localRef) {
      transaction.localRef = dto.localRef;
    }
    transaction.updatedBy = userId;

    return transaction.save();
  }

  async deleteForCurrentUser(userId: string, id: string): Promise<Transaction> {
    const business = await this.businessService.findByOwnerId(userId);
    const transaction = await this.transactionModel.findById(id).exec();

    if (!transaction || transaction.deletedAt) {
      throw new NotFoundException('Transaction not found');
    }
    if (transaction.businessId !== business.id) {
      throw new ForbiddenException('You do not have access to this transaction');
    }

    transaction.deletedAt = new Date();
    transaction.updatedBy = userId;
    return transaction.save();
  }

  async getTransactionsForRange(businessId: string, from: Date, to: Date): Promise<Transaction[]> {
    return this.transactionModel
      .find({ businessId, deletedAt: null, occurredAt: { $gte: from, $lte: to } })
      .sort({ occurredAt: -1 })
      .exec();
  }
}
