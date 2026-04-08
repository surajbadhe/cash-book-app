import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { BusinessService } from '../business/business.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesDto } from './dto/list-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category, CategoryType } from './schemas/category.schema';

const DEFAULT_CATEGORIES: Array<Pick<Category, 'name' | 'type' | 'sortOrder' | 'isDefault'>> = [
  { name: 'Food Sales', type: CategoryType.CASH_IN, sortOrder: 1, isDefault: true },
  { name: 'Beverage Sales', type: CategoryType.CASH_IN, sortOrder: 2, isDefault: true },
  { name: 'Online Orders', type: CategoryType.CASH_IN, sortOrder: 3, isDefault: true },
  { name: 'Catering', type: CategoryType.CASH_IN, sortOrder: 4, isDefault: true },
  { name: 'Other Income', type: CategoryType.CASH_IN, sortOrder: 5, isDefault: true },
  { name: 'Inventory', type: CategoryType.CASH_OUT, sortOrder: 1, isDefault: true },
  { name: 'Utilities', type: CategoryType.CASH_OUT, sortOrder: 2, isDefault: true },
  { name: 'Rent', type: CategoryType.CASH_OUT, sortOrder: 3, isDefault: true },
  { name: 'Staff Wages', type: CategoryType.CASH_OUT, sortOrder: 4, isDefault: true },
  { name: 'Maintenance', type: CategoryType.CASH_OUT, sortOrder: 5, isDefault: true },
  { name: 'Transport', type: CategoryType.CASH_OUT, sortOrder: 6, isDefault: true },
  { name: 'Marketing', type: CategoryType.CASH_OUT, sortOrder: 7, isDefault: true },
  { name: 'Other Expense', type: CategoryType.CASH_OUT, sortOrder: 8, isDefault: true },
];

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    private readonly businessService: BusinessService,
  ) {}

  async listForCurrentUser(userId: string, query: ListCategoriesDto, businessId?: string): Promise<Category[]> {
    const business = await this.businessService.resolveForUser(userId, businessId);
    const filters: Record<string, unknown> = { businessId: business.id };

    if (query.type) {
      filters.type = query.type;
    }
    if (typeof query.active === 'boolean') {
      filters.isActive = query.active;
    }

    return this.categoryModel.find(filters).sort({ type: 1, sortOrder: 1, name: 1 }).exec();
  }

  async createForCurrentUser(userId: string, dto: CreateCategoryDto, businessId?: string): Promise<Category> {
    const business = await this.businessService.resolveForUser(userId, businessId);
    const existing = await this.categoryModel
      .findOne({ businessId: business.id, type: dto.type, name: dto.name.trim() })
      .exec();

    if (existing) {
      throw new ConflictException('Category already exists');
    }

    const category = new this.categoryModel({
      businessId: business.id,
      ...dto,
      name: dto.name.trim(),
      isDefault: false,
      isActive: true,
      sortOrder: dto.sortOrder ?? 0,
    });

    return category.save();
  }

  async updateForCurrentUser(userId: string, id: string, dto: UpdateCategoryDto, businessId?: string): Promise<Category> {
    const business = await this.businessService.resolveForUser(userId, businessId);
    const category = await this.categoryModel.findById(id).exec();

    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (category.businessId !== business.id) {
      throw new ForbiddenException('You do not have access to this category');
    }

    Object.assign(category, dto);
    return category.save();
  }

  async deactivateForCurrentUser(userId: string, id: string, businessId?: string): Promise<Category> {
    const business = await this.businessService.resolveForUser(userId, businessId);
    const category = await this.categoryModel.findById(id).exec();

    if (!category) {
      throw new NotFoundException('Category not found');
    }
    if (category.businessId !== business.id) {
      throw new ForbiddenException('You do not have access to this category');
    }

    category.isActive = false;
    return category.save();
  }

  async seedDefaultsForCurrentUser(userId: string, businessId?: string): Promise<Category[]> {
    const business = await this.businessService.resolveForUser(userId, businessId);
    const existing = await this.categoryModel.find({ businessId: business.id }).exec();
    const existingKeys = new Set(existing.map((category) => `${category.type}:${category.name.toLowerCase()}`));

    const toCreate = DEFAULT_CATEGORIES.filter(
      (item) => !existingKeys.has(`${item.type}:${item.name.toLowerCase()}`),
    ).map(
      (item) =>
        new this.categoryModel({
          businessId: business.id,
          ...item,
          isActive: true,
        }),
    );

    if (toCreate.length > 0) {
      await this.categoryModel.insertMany(toCreate);
    }

    return this.categoryModel.find({ businessId: business.id, isActive: true }).sort({ type: 1, sortOrder: 1 }).exec();
  }

  async findByIdForBusiness(businessId: string, categoryId: string): Promise<Category> {
    if (!isValidObjectId(categoryId)) {
      throw new BadRequestException('Invalid categoryId');
    }

    const category = await this.categoryModel.findOne({ _id: categoryId, businessId, isActive: true }).exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async findOrCreateForBusiness(
    businessId: string,
    name: string,
    type: CategoryType,
  ): Promise<Category> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new BadRequestException('Category name is required');
    }

    const existing = await this.categoryModel
      .findOne({
        businessId,
        type,
        name: trimmedName,
      })
      .exec();

    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        return existing.save();
      }

      return existing;
    }

    const lastCategory = await this.categoryModel
      .findOne({ businessId, type })
      .sort({ sortOrder: -1, createdAt: -1 })
      .exec();

    const category = new this.categoryModel({
      businessId,
      name: trimmedName,
      type,
      isDefault: false,
      isActive: true,
      sortOrder: (lastCategory?.sortOrder ?? 0) + 1,
    });

    return category.save();
  }
}
