import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get business app settings' })
  async get(@CurrentUser('sub') userId: string) {
    const settings = await this.settingsService.getForCurrentUser(userId);
    return {
      success: true,
      message: 'Settings retrieved successfully',
      data: settings,
    };
  }

  @Patch()
  @ApiOperation({ summary: 'Update business app settings' })
  async update(@CurrentUser('sub') userId: string, @Body() dto: UpdateSettingsDto) {
    const settings = await this.settingsService.updateForCurrentUser(userId, dto);
    return {
      success: true,
      message: 'Settings updated successfully',
      data: settings,
    };
  }
}
