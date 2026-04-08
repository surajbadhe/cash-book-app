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
import { CategoryType } from '../category/schemas/category.schema';

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

  async createForCurrentUser(userId: string, dto: CreateTransactionDto, businessId?: string): Promise<Transaction> {
    const business = await this.businessService.resolveForUser(userId, businessId);
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

  async importForCurrentUser(userId: string, file: { buffer?: Buffer; originalname?: string } | undefined, businessId?: string) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('CSV file is required');
    }

    const business = await this.businessService.resolveForUser(userId, businessId);
    const content = file.buffer.toString('utf8').replace(/^\uFEFF/, '').trim();

    if (!content) {
      throw new BadRequestException('Uploaded file is empty');
    }

    const rows = this.parseDelimitedContent(content);
    if (rows.length < 2) {
      throw new BadRequestException('CSV must include a header row and at least one data row');
    }

    const headers = rows[0].map((header) => this.normalizeHeader(header));
    const dataRows = rows.slice(1);
    const requiredHeaders = ['date', 'time', 'cashin', 'cashout'];

    for (const header of requiredHeaders) {
      if (!headers.includes(header)) {
        throw new BadRequestException(`Missing required column: ${header}`);
      }
    }

    const categoryCache = new Map<string, string>();
    const documents: Array<Partial<Transaction>> = [];
    const errors: Array<{
      rowNumber: number;
      message: string;
      values: Record<string, string>;
    }> = [];
    let skippedCount = 0;
    let categoriesCreated = 0;

    for (let index = 0; index < dataRows.length; index++) {
      const row = dataRows[index];
      const rowNumber = index + 2;

      if (row.every((value) => !value.trim())) {
        continue;
      }

      try {
        const mapped = this.mapRowToRecord(headers, row);
        const amountIn = this.parseAmount(mapped.cashin);
        const amountOut = this.parseAmount(mapped.cashout);

        if (amountIn <= 0 && amountOut <= 0) {
          skippedCount++;
          continue;
        }

        if (amountIn > 0 && amountOut > 0) {
          throw new BadRequestException('Both Cash In and Cash Out contain values');
        }

        const type = amountIn > 0 ? CategoryType.CASH_IN : CategoryType.CASH_OUT;
        const amount = amountIn > 0 ? amountIn : amountOut;
        const categoryName =
          mapped.category?.trim() || (type === CategoryType.CASH_IN ? 'Other Income' : 'Other Expense');
        const categoryKey = `${type}:${categoryName.toLowerCase()}`;

        let categoryId = categoryCache.get(categoryKey);
        if (!categoryId) {
          const existing = await this.categoryService.findOrCreateForBusiness(
            business.id,
            categoryName,
            type,
          );
          categoryId = existing.id;
          categoryCache.set(categoryKey, categoryId);
          if (!mapped.category?.trim()) {
            // default category may have existed already; don't count
          } else if (existing.sortOrder > 0 && !existing.isDefault) {
            categoriesCreated++;
          }
        }

        documents.push({
          businessId: business.id,
          type,
          amount,
          categoryId,
          categoryName,
          occurredAt: this.parseOccurredAt(mapped.date, mapped.time),
          note: this.buildImportNote(mapped),
          source: TransactionSource.SYNC,
          createdBy: userId,
          updatedBy: userId,
          deletedAt: null,
        });
      } catch (error) {
        errors.push({
          rowNumber,
          message: error instanceof Error ? error.message : 'Invalid row data',
          values: {
            date: row[headers.indexOf('date')] || '',
            time: row[headers.indexOf('time')] || '',
            amount: row[headers.indexOf('cashin')] || row[headers.indexOf('cashout')] || '',
            category: row[headers.indexOf('category')] || '',
            remark: row[headers.indexOf('remark')] || '',
          },
        });
      }
    }

    if (!documents.length) {
      const firstError = errors[0];
      throw new BadRequestException(
        firstError
          ? `Unable to import file. Row ${firstError.rowNumber}: ${firstError.message}`
          : 'No valid transactions found in uploaded file',
      );
    }

    const inserted = await this.transactionModel.insertMany(documents, { ordered: false });

    return {
      createdCount: inserted.length,
      skippedCount,
      categoriesCreated,
      errors: errors.map((err) => ({
        rowNumber: err.rowNumber,
        message: err.message,
        date: err.values.date,
        amount: err.values.amount,
        category: err.values.category,
      })),
    };
  }

  async listForCurrentUser(userId: string, query: ListTransactionsDto, businessId?: string) {
    const business = await this.businessService.resolveForUser(userId, businessId);
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

    const itemsPromise =
      sortBy === 'amount'
        ? this.transactionModel
            .aggregate([
              { $match: filters },
              {
                $addFields: {
                  __signedAmount: {
                    $cond: [
                      { $eq: ['$type', CategoryType.CASH_OUT] },
                      { $multiply: ['$amount', -1] },
                      '$amount',
                    ],
                  },
                },
              },
              { $sort: { __signedAmount: sortOrder, occurredAt: -1 } },
              { $skip: skip },
              { $limit: limit },
              { $project: { __signedAmount: 0 } },
            ])
            .exec()
        : this.transactionModel
            .find(filters)
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(limit)
            .exec();

    const [items, total, summaryRows] = await Promise.all([
      itemsPromise,
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

  async updateForCurrentUser(userId: string, id: string, dto: UpdateTransactionDto, businessId?: string): Promise<Transaction> {
    const business = await this.businessService.resolveForUser(userId, businessId);
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

  async deleteForCurrentUser(userId: string, id: string, businessId?: string): Promise<Transaction> {
    const business = await this.businessService.resolveForUser(userId, businessId);
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

  async bulkDeleteForCurrentUser(userId: string, ids: string[], businessId?: string): Promise<{ deletedCount: number }> {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('No transaction IDs provided');
    }

    if (ids.length > 100) {
      throw new BadRequestException('Cannot delete more than 100 transactions at once');
    }

    const business = await this.businessService.resolveForUser(userId, businessId);
    const transactions = await this.transactionModel
      .find({ _id: { $in: ids }, businessId: business.id, deletedAt: null })
      .exec();

    if (transactions.length === 0) {
      throw new NotFoundException('No accessible transactions found to delete');
    }

    const now = new Date();
    const updateResult = await this.transactionModel.updateMany(
      { _id: { $in: transactions.map((t) => t._id) } },
      { deletedAt: now, updatedBy: userId },
    );

    return {
      deletedCount: updateResult.modifiedCount || transactions.length,
    };
  }

  async getTransactionsForRange(businessId: string, from: Date, to: Date): Promise<Transaction[]> {
    return this.transactionModel
      .find({ businessId, deletedAt: null, occurredAt: { $gte: from, $lte: to } })
      .sort({ occurredAt: -1 })
      .exec();
  }

  private parseDelimitedContent(content: string): string[][] {
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const delimiter = this.detectDelimiter(lines[0] || '');
    return lines.map((line) => this.splitDelimitedLine(line, delimiter));
  }

  private detectDelimiter(headerLine: string): string {
    const tabCount = (headerLine.match(/\t/g) || []).length;
    const commaCount = (headerLine.match(/,/g) || []).length;
    return tabCount >= commaCount ? '\t' : ',';
  }

  private splitDelimitedLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current.trim());
    return values;
  }

  private normalizeHeader(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private mapRowToRecord(headers: string[], row: string[]): Record<string, string> {
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = row[index]?.trim() || '';
      return acc;
    }, {});
  }

  private parseAmount(value?: string): number {
    if (!value) {
      return 0;
    }

    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) {
      return 0;
    }

    const amount = Number(normalized);
    if (Number.isNaN(amount)) {
      throw new BadRequestException(`Invalid amount: ${value}`);
    }

    return amount;
  }

  private parseOccurredAt(dateValue?: string, timeValue?: string): Date {
    const { year, month, day } = this.parseImportedDate((dateValue || '').trim(), dateValue);
    const { hour, minute, second } = this.parseImportedTime((timeValue || '').trim(), timeValue);

    const occurredAt = new Date(Date.UTC(year, month, day, hour, minute, second));
    if (
      Number.isNaN(occurredAt.getTime()) ||
      occurredAt.getUTCFullYear() !== year ||
      occurredAt.getUTCMonth() !== month ||
      occurredAt.getUTCDate() !== day
    ) {
      throw new BadRequestException(`Invalid date/time: ${dateValue} ${timeValue}`);
    }

    return occurredAt;
  }

  private parseImportedDate(
    value: string,
    originalValue?: string,
  ): { year: number; month: number; day: number } {
    if (!value) {
      throw new BadRequestException(`Invalid date: ${originalValue}`);
    }

    const normalized = value.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    const month = this.parseMonthNameDate(normalized);
    if (month) {
      return month;
    }

    const numeric = normalized.match(/^(\d{1,4})[./\-\s](\d{1,2})[./\-\s](\d{1,4})$/);
    if (numeric) {
      const [, firstRaw, secondRaw, thirdRaw] = numeric;
      const first = Number(firstRaw);
      const second = Number(secondRaw);
      const third = Number(thirdRaw);

      if (firstRaw.length === 4) {
        return { year: first, month: second - 1, day: third };
      }

      const year = this.normalizeImportedYear(thirdRaw);

      if (first > 12) {
        return { year, month: second - 1, day: first };
      }

      if (second > 12) {
        return { year, month: first - 1, day: second };
      }

      return { year, month: second - 1, day: first };
    }

    throw new BadRequestException(`Invalid date: ${originalValue}`);
  }

  private parseMonthNameDate(value: string): { year: number; month: number; day: number } | null {
    const monthNames: Record<string, number> = {
      jan: 0,
      january: 0,
      feb: 1,
      february: 1,
      mar: 2,
      march: 2,
      apr: 3,
      april: 3,
      may: 4,
      jun: 5,
      june: 5,
      jul: 6,
      july: 6,
      aug: 7,
      august: 7,
      sep: 8,
      sept: 8,
      september: 8,
      oct: 9,
      october: 9,
      nov: 10,
      november: 10,
      dec: 11,
      december: 11,
    };

    const dayFirst = value.match(/^(\d{1,2})[./\-\s]([A-Za-z]{3,9})[./\-\s](\d{2,4})$/);
    if (dayFirst) {
      const month = monthNames[dayFirst[2].toLowerCase()];
      if (month !== undefined) {
        return {
          year: this.normalizeImportedYear(dayFirst[3]),
          month,
          day: Number(dayFirst[1]),
        };
      }
    }

    const monthFirst = value.match(/^([A-Za-z]{3,9})[./\-\s](\d{1,2})[./\-\s](\d{2,4})$/);
    if (monthFirst) {
      const month = monthNames[monthFirst[1].toLowerCase()];
      if (month !== undefined) {
        return {
          year: this.normalizeImportedYear(monthFirst[3]),
          month,
          day: Number(monthFirst[2]),
        };
      }
    }

    return null;
  }

  private normalizeImportedYear(value: string): number {
    return Number(value.length === 2 ? `20${value}` : value);
  }

  private parseImportedTime(
    value: string,
    originalValue?: string,
  ): { hour: number; minute: number; second: number } {
    if (!value) {
      return { hour: 0, minute: 0, second: 0 };
    }

    const amPmMatch = value.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)$/i);
    if (amPmMatch) {
      const hourRaw = Number(amPmMatch[1]);
      const minute = Number(amPmMatch[2] || '0');
      const second = Number(amPmMatch[3] || '0');

      if (hourRaw < 1 || hourRaw > 12 || minute > 59 || second > 59) {
        throw new BadRequestException(`Invalid time: ${originalValue}`);
      }

      let hour = hourRaw % 12;
      if (amPmMatch[4].toUpperCase() === 'PM') {
        hour += 12;
      }

      return { hour, minute, second };
    }

    const twentyFourHourMatch = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (twentyFourHourMatch) {
      const hour = Number(twentyFourHourMatch[1]);
      const minute = Number(twentyFourHourMatch[2]);
      const second = Number(twentyFourHourMatch[3] || '0');

      if (hour > 23 || minute > 59 || second > 59) {
        throw new BadRequestException(`Invalid time: ${originalValue}`);
      }

      return { hour, minute, second };
    }

    throw new BadRequestException(`Invalid time: ${originalValue}`);
  }

  private buildImportNote(mapped: Record<string, string>): string | undefined {
    const parts = [mapped.remark];

    if (mapped.party) {
      parts.push(`Party: ${mapped.party}`);
    }
    if (mapped.mode) {
      parts.push(`Mode: ${mapped.mode}`);
    }
    if (mapped.entryby) {
      parts.push(`Entry By: ${mapped.entryby}`);
    }

    const note = parts.filter(Boolean).join(' | ').trim();
    return note || undefined;
  }
}
