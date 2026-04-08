import { Body, Controller, Get, Patch, Post, UseGuards, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateBusinessDto } from './dto/create-business.dto';
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

  @Get('me')
  @ApiOperation({ summary: 'Get current user business' })
  async getMine(@CurrentUser('sub') userId: string) {
    const business = await this.businessService.findByOwnerId(userId);
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
}
