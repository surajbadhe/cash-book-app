import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'List books accessible to the current user' })
  async list(@CurrentUser('sub') userId: string) {
    const businesses = await this.businessService.listForUser(userId);
    return {
      success: true,
      message: 'Businesses retrieved successfully',
      data: businesses,
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get currently selected book for the current user' })
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

  @Delete(':businessId')
  @ApiOperation({ summary: 'Delete business profile' })
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('businessId') businessId: string,
  ) {
    const result = await this.businessService.remove(userId, businessId);
    return {
      success: true,
      message: 'Business deleted successfully',
      data: result,
    };
  }

  @Get(':businessId/members')
  @ApiOperation({ summary: 'List book team members' })
  async listMembers(@CurrentUser('sub') userId: string, @Param('businessId') businessId: string) {
    const members = await this.businessService.listMembers(userId, businessId);
    return {
      success: true,
      message: 'Business members retrieved successfully',
      data: members,
    };
  }

  @Post(':businessId/members')
  @ApiOperation({ summary: 'Add a member to a book' })
  async addMember(
    @CurrentUser('sub') userId: string,
    @Param('businessId') businessId: string,
    @Body() dto: AddBusinessMemberDto,
  ) {
    const members = await this.businessService.addMember(userId, businessId, dto);
    return {
      success: true,
      message: 'Member added successfully',
      data: members,
    };
  }

  @Patch(':businessId/members/:memberUserId')
  @ApiOperation({ summary: 'Update member role for a book' })
  async updateMember(
    @CurrentUser('sub') userId: string,
    @Param('businessId') businessId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: UpdateBusinessMemberDto,
  ) {
    const member = await this.businessService.updateMember(userId, businessId, memberUserId, dto);
    return {
      success: true,
      message: 'Member role updated successfully',
      data: member,
    };
  }

  @Delete(':businessId/members/:memberUserId')
  @ApiOperation({ summary: 'Remove a member from a book' })
  async removeMember(
    @CurrentUser('sub') userId: string,
    @Param('businessId') businessId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    const result = await this.businessService.removeMember(userId, businessId, memberUserId);
    return {
      success: true,
      message: 'Member removed successfully',
      data: result,
    };
  }

  @Post(':businessId/invites')
  @ApiOperation({ summary: 'Send email invite to join a book' })
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
}
