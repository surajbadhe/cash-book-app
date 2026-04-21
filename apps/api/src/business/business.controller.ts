import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AcceptBusinessInviteDto } from './dto/accept-business-invite.dto';
import { AddBusinessMemberDto } from './dto/add-business-member.dto';
import { CreateBusinessInviteDto } from './dto/create-business-invite.dto';
import { PreviewBusinessInviteDto } from './dto/preview-business-invite.dto';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessMemberDto } from './dto/update-business-member.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { BusinessService } from './business.service';

@ApiTags('businesses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  @ApiOperation({ summary: 'Create a business for the current user' })
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateBusinessDto) {
    const business = await this.businessService.create(userId, dto);
    return {
      success: true,
      message: 'Business created successfully',
      data: business,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List shops accessible to the current user' })
  async list(@CurrentUser('sub') userId: string) {
    const businesses = await this.businessService.listForUser(userId);
    return {
      success: true,
      message: 'Businesses retrieved successfully',
      data: businesses,
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get currently selected shop for the current user' })
  async getMine(@CurrentUser('sub') userId: string, @Headers('x-business-id') businessId?: string) {
    const business = await this.businessService.resolveForUser(userId, businessId);
    return {
      success: true,
      message: 'Business retrieved successfully',
      data: business,
    };
  }

  @Patch(':businessId')
  @ApiOperation({ summary: 'Update business profile' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    const business = await this.businessService.update(userId, businessId, dto);
    return {
      success: true,
      message: 'Business updated successfully',
      data: business,
    };
  }

  @Get(':businessId/members')
  @ApiOperation({ summary: 'List shop team members' })
  async listMembers(@CurrentUser('sub') userId: string, @Param('businessId') businessId: string) {
    const members = await this.businessService.listMembers(userId, businessId);
    return {
      success: true,
      message: 'Business members retrieved successfully',
      data: members,
    };
  }

  @Post(':businessId/members')
  @ApiOperation({ summary: 'Add an employee to a shop' })
  async addMember(
    @CurrentUser('sub') userId: string,
    @Param('businessId') businessId: string,
    @Body() dto: AddBusinessMemberDto,
  ) {
    const members = await this.businessService.addMember(userId, businessId, dto);
    return {
      success: true,
      message: 'Employee added successfully',
      data: members,
    };
  }

  @Patch(':businessId/members/:memberUserId')
  @ApiOperation({ summary: 'Update employee role for a shop' })
  async updateMember(
    @CurrentUser('sub') userId: string,
    @Param('businessId') businessId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: UpdateBusinessMemberDto,
  ) {
    const member = await this.businessService.updateMember(userId, businessId, memberUserId, dto);
    return {
      success: true,
      message: 'Employee role updated successfully',
      data: member,
    };
  }

  @Delete(':businessId/members/:memberUserId')
  @ApiOperation({ summary: 'Remove an employee from a shop' })
  async removeMember(
    @CurrentUser('sub') userId: string,
    @Param('businessId') businessId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    const result = await this.businessService.removeMember(userId, businessId, memberUserId);
    return {
      success: true,
      message: 'Employee removed successfully',
      data: result,
    };
  }

  @Post(':businessId/invites')
  @ApiOperation({ summary: 'Send email invite to join a shop' })
  async inviteMember(
    @CurrentUser('sub') userId: string,
    @Param('businessId') businessId: string,
    @Body() dto: CreateBusinessInviteDto,
  ) {
    const invite = await this.businessService.createInvite(userId, businessId, dto);
    return {
      success: true,
      message: 'Invite sent successfully',
      data: invite,
    };
  }

  @Public()
  @Get('invites/preview')
  @ApiOperation({ summary: 'Preview invite details from email token' })
  async previewInvite(@Query() query: PreviewBusinessInviteDto) {
    const details = await this.businessService.getInvitePreview(query.token);
    return {
      success: true,
      message: 'Invite preview retrieved successfully',
      data: details,
    };
  }

  @Post('invites/accept')
  @ApiOperation({ summary: 'Accept invite for current logged-in user' })
  async acceptInvite(@CurrentUser('sub') userId: string, @Body() dto: AcceptBusinessInviteDto) {
    const accepted = await this.businessService.acceptInvite(userId, dto);
    return {
      success: true,
      message: 'Invite accepted successfully',
      data: accepted,
    };
  }

  @Delete(':businessId')
  @ApiOperation({ summary: 'Delete a shop and all its data (owner only)' })
  async deleteBusiness(
    @CurrentUser('sub') userId: string,
    @Param('businessId') businessId: string,
  ) {
    await this.businessService.deleteBusiness(userId, businessId);
    return {
      success: true,
      message: 'Shop and all associated data deleted successfully',
    };
  }
}
