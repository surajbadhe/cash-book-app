import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesDto } from './dto/list-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'List business categories' })
  async list(@CurrentUser('sub') userId: string, @Query() query: ListCategoriesDto) {
    const categories = await this.categoryService.listForCurrentUser(userId, query);
    return {
      success: true,
      message: 'Categories retrieved successfully',
      data: categories,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create category' })
  async create(@CurrentUser('sub') userId: string, @Body() dto: CreateCategoryDto) {
    const category = await this.categoryService.createForCurrentUser(userId, dto);
    return {
      success: true,
      message: 'Category created successfully',
      data: category,
    };
  }

  @Post('seed-defaults')
  @ApiOperation({ summary: 'Seed default restaurant categories' })
  async seedDefaults(@CurrentUser('sub') userId: string) {
    const categories = await this.categoryService.seedDefaultsForCurrentUser(userId);
    return {
      success: true,
      message: 'Default categories seeded successfully',
      data: categories,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update category' })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const category = await this.categoryService.updateForCurrentUser(userId, id, dto);
    return {
      success: true,
      message: 'Category updated successfully',
      data: category,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate category' })
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    const category = await this.categoryService.deactivateForCurrentUser(userId, id);
    return {
      success: true,
      message: 'Category deleted successfully',
      data: category,
    };
  }
}
