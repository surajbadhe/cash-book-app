import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import * as crypto from 'crypto';
import { EmailService } from '../auth/email.service';
import { UserService } from '../user/user.service';
import { AcceptBusinessInviteDto } from './dto/accept-business-invite.dto';
import { AddBusinessMemberDto } from './dto/add-business-member.dto';
import { CreateBusinessInviteDto } from './dto/create-business-invite.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessMemberDto } from './dto/update-business-member.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { BusinessInvite } from './schemas/business-invite.schema';
import { Business, BusinessMemberRole } from './schemas/business.schema';

@Injectable()
export class BusinessService {
  constructor(
    @InjectModel(Business.name) private readonly businessModel: Model<Business>,
    @InjectModel(BusinessInvite.name) private readonly businessInviteModel: Model<BusinessInvite>,
    private readonly userService: UserService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async create(ownerId: string, dto: CreateBusinessDto): Promise<Business> {
    const normalizedName = dto.name.trim();
    const existing = await this.businessModel
      .findOne({ ownerId, isActive: true, name: normalizedName })
      .exec();
    if (existing) {
      throw new ConflictException('A book with this name already exists');
    }

    const owner = await this.userService.findById(ownerId);
    if (!owner) {
      throw new NotFoundException('User not found');
    }

    const business = new this.businessModel({
      ownerId,
      ...dto,
      name: normalizedName,
      currency: dto.currency ?? 'INR',
      timezone: dto.timezone ?? 'Asia/Kolkata',
      members: [
        {
          userId: ownerId,
          email: owner.email,
          role: BusinessMemberRole.OWNER,
          isActive: true,
          joinedAt: new Date(),
        },
      ],
    });

    return business.save();
  }

  async listForUser(userId: string): Promise<Array<Business & { accessRole: BusinessMemberRole }>> {
    const businesses = await this.businessModel
      .find({
        isActive: true,
        $or: [{ ownerId: userId }, { members: { $elemMatch: { userId, isActive: true } } }],
      })
      .sort({ createdAt: 1, name: 1 })
      .exec();

    return businesses.map((business) => Object.assign(business, { accessRole: this.getAccessRole(business, userId) }));
  }

  async findByOwnerId(ownerId: string): Promise<Business> {
    const business = await this.businessModel.findOne({ ownerId, isActive: true }).sort({ createdAt: 1 }).exec();
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }

  async resolveForUser(userId: string, businessId?: string): Promise<Business> {
    if (businessId) {
      if (!isValidObjectId(businessId)) {
        throw new BadRequestException('Invalid businessId');
      }

      const business = await this.businessModel.findById(businessId).exec();
      if (!business || !business.isActive) {
        throw new NotFoundException('Business not found');
      }
      if (!this.hasAccess(business, userId)) {
        throw new ForbiddenException('You do not have access to this book');
      }

      return business;
    }

    const [ownedBusiness, memberBusiness] = await Promise.all([
      this.businessModel.findOne({ ownerId: userId, isActive: true }).sort({ createdAt: 1 }).exec(),
      this.businessModel
        .findOne({ isActive: true, members: { $elemMatch: { userId, isActive: true } } })
        .sort({ createdAt: 1 })
        .exec(),
    ]);

    const business = ownedBusiness ?? memberBusiness;
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return business;
  }

  async update(ownerId: string, businessId: string, dto: UpdateBusinessDto): Promise<Business> {
    const business = await this.resolveForUser(ownerId, businessId);
    if (!this.isOwner(business, ownerId)) {
      throw new ForbiddenException('You do not have permission to update this book');
    }

    Object.assign(business, {
      ...dto,
      name: dto.name?.trim() ?? business.name,
    });
    return business.save();
  }

  async remove(userId: string, businessId: string): Promise<{ deleted: true }> {
    const business = await this.resolveForUser(userId, businessId);
    if (!this.isOwner(business, userId)) {
      throw new ForbiddenException('You do not have permission to delete this book');
    }

    business.isActive = false;
    await business.save();

    return { deleted: true };
  }

  async listMembers(userId: string, businessId: string) {
    const business = await this.resolveForUser(userId, businessId);
    return business.members
      .filter((member) => member.isActive)
      .sort((a, b) => {
        if (a.role === BusinessMemberRole.OWNER) return -1;
        if (b.role === BusinessMemberRole.OWNER) return 1;
        return a.email.localeCompare(b.email);
      });
  }

  async addMember(userId: string, businessId: string, dto: AddBusinessMemberDto) {
    const business = await this.resolveForUser(userId, businessId);
    if (!this.canManageShop(business, userId)) {
      throw new ForbiddenException('You do not have permission to manage team members');
    }

    const memberEmail = dto.email.trim().toLowerCase();
    const memberUser = await this.userService.findByEmail(memberEmail);
    if (!memberUser) {
      throw new NotFoundException('User account not found. Ask them to register first.');
    }
    if (memberUser.id === business.ownerId) {
      throw new ConflictException('Owner is already part of this book');
    }

    const existing = business.members.find((member) => member.userId === memberUser.id);
    if (existing?.isActive) {
      throw new ConflictException('Member already has access to this book');
    }

    if (existing) {
      existing.email = memberUser.email;
      existing.role = dto.role ?? BusinessMemberRole.EDITOR;
      existing.isActive = true;
      existing.joinedAt = new Date();
    } else {
      business.members.push({
        userId: memberUser.id,
        email: memberUser.email,
        role: dto.role ?? BusinessMemberRole.EDITOR,
        isActive: true,
        joinedAt: new Date(),
      } as any);
    }

    await business.save();
    return business.members.filter((member) => member.isActive);
  }

  async updateMember(userId: string, businessId: string, memberUserId: string, dto: UpdateBusinessMemberDto) {
    const business = await this.resolveForUser(userId, businessId);
    if (!this.canManageShop(business, userId)) {
      throw new ForbiddenException('You do not have permission to manage team members');
    }

    if (memberUserId === business.ownerId) {
      throw new BadRequestException('Owner role cannot be changed');
    }

    const member = business.members.find((item) => item.userId === memberUserId && item.isActive);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    member.role = dto.role;
    await business.save();
    return member;
  }

  async removeMember(userId: string, businessId: string, memberUserId: string) {
    const business = await this.resolveForUser(userId, businessId);
    if (!this.canManageShop(business, userId)) {
      throw new ForbiddenException('You do not have permission to manage team members');
    }

    if (memberUserId === business.ownerId) {
      throw new BadRequestException('Owner cannot be removed from the book');
    }

    const member = business.members.find((item) => item.userId === memberUserId && item.isActive);
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    member.isActive = false;
    await business.save();

    return { removed: true };
  }

  async createInvite(userId: string, businessId: string, dto: CreateBusinessInviteDto) {
    const business = await this.resolveForUser(userId, businessId);
    if (!this.canManageShop(business, userId)) {
      throw new ForbiddenException('You do not have permission to invite team members');
    }

    const inviter = await this.userService.findById(userId);
    if (!inviter) {
      throw new NotFoundException('Inviter account not found');
    }

    const role = dto.role && dto.role !== BusinessMemberRole.OWNER ? dto.role : BusinessMemberRole.VIEWER;
    const email = dto.email.trim().toLowerCase();

    if (business.members.some((member) => member.email === email && member.isActive)) {
      throw new ConflictException('User already has access to this book');
    }

    await this.businessInviteModel.updateMany(
      {
        businessId: business.id,
        email,
        acceptedAt: null,
        cancelledAt: null,
      },
      {
        cancelledAt: new Date(),
      },
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.businessInviteModel.create({
      businessId: business.id,
      email,
      role,
      invitedByUserId: userId,
      invitedByEmail: inviter.email,
      tokenHash,
      expiresAt,
      acceptedAt: null,
      acceptedByUserId: null,
      cancelledAt: null,
    });

    const clientUrl = this.configService.get<string>('cors.origin') || 'http://localhost:4200';
    const acceptUrl = `${clientUrl}/invite/accept?token=${rawToken}`;
    await this.emailService.sendBusinessInviteEmail(
      email,
      business.name,
      inviter.email,
      acceptUrl,
      role.charAt(0).toUpperCase() + role.slice(1),
    );

    return {
      id: invite.id,
      businessId: invite.businessId,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    };
  }

  async getInvitePreview(rawToken: string) {
    const invite = await this.findActiveInvite(rawToken);
    const business = await this.businessModel.findById(invite.businessId).exec();
    if (!business || !business.isActive) {
      throw new NotFoundException('Book not found');
    }

    return {
      businessId: business.id,
      businessName: business.name,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    };
  }

  async acceptInvite(userId: string, dto: AcceptBusinessInviteDto) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const invite = await this.findActiveInvite(dto.token);
    if (invite.email !== user.email.toLowerCase()) {
      throw new ForbiddenException('This invite was sent to a different email address');
    }

    const business = await this.businessModel.findById(invite.businessId).exec();
    if (!business || !business.isActive) {
      throw new NotFoundException('Book not found');
    }

    const existingMember = business.members.find((member) => member.userId === user.id);
    if (existingMember) {
      existingMember.email = user.email;
      existingMember.role = invite.role;
      existingMember.isActive = true;
      existingMember.joinedAt = existingMember.joinedAt || new Date();
    } else {
      business.members.push({
        userId: user.id,
        email: user.email,
        role: invite.role,
        isActive: true,
        joinedAt: new Date(),
      } as any);
    }

    await business.save();

    invite.acceptedAt = new Date();
    invite.acceptedByUserId = user.id;
    await invite.save();

    return {
      businessId: business.id,
      businessName: business.name,
      role: invite.role,
    };
  }

  private async findActiveInvite(rawToken: string): Promise<BusinessInvite> {
    const tokenHash = this.hashToken(rawToken);
    const invite = await this.businessInviteModel
      .findOne({
        tokenHash,
        acceptedAt: null,
        cancelledAt: null,
        expiresAt: { $gt: new Date() },
      })
      .exec();

    if (!invite) {
      throw new NotFoundException('Invite is invalid or expired');
    }

    return invite;
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private hasAccess(business: Business, userId: string): boolean {
    return business.ownerId === userId || business.members.some((member) => member.userId === userId && member.isActive);
  }

  public getAccessRole(business: Business, userId: string): BusinessMemberRole {
    if (business.ownerId === userId) {
      return BusinessMemberRole.OWNER;
    }
    return business.members.find((member) => member.userId === userId && member.isActive)?.role ?? BusinessMemberRole.VIEWER;
  }

  private canManageShop(business: Business, userId: string): boolean {
    const role = this.getAccessRole(business, userId);
    return role === BusinessMemberRole.OWNER || role === BusinessMemberRole.ADMIN;
  }

  private isOwner(business: Business, userId: string): boolean {
    return business.ownerId === userId;
  }
}
