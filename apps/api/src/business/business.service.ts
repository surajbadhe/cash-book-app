import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { Business } from './schemas/business.schema';

@Injectable()
export class BusinessService {
  constructor(@InjectModel(Business.name) private readonly businessModel: Model<Business>) {}

  async create(ownerId: string, dto: CreateBusinessDto): Promise<Business> {
    const existing = await this.businessModel.findOne({ ownerId, isActive: true }).exec();
    if (existing) {
      throw new ConflictException('An active business already exists for this user');
    }

    const business = new this.businessModel({
      ownerId,
      ...dto,
      currency: dto.currency ?? 'INR',
      timezone: dto.timezone ?? 'Asia/Kolkata',
    });

    return business.save();
  }

  async findByOwnerId(ownerId: string): Promise<Business> {
    const business = await this.businessModel.findOne({ ownerId, isActive: true }).exec();
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }

  async update(ownerId: string, businessId: string, dto: UpdateBusinessDto): Promise<Business> {
    const business = await this.businessModel.findById(businessId).exec();
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    if (business.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this business');
    }

    Object.assign(business, dto);
    return business.save();
  }
}
