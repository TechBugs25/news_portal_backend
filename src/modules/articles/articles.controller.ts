import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { User } from '../users/entities/user.entity';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { QueryArticleDto } from './dto/query-article.dto';
import {
  UpdateArticleDto,
  UpdateArticleStatusDto,
} from './dto/update-article.dto';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get published articles feed with filters and pagination (Public)',
  })
  findAllPublic(@Query() query: QueryArticleDto) {
    return this.articlesService.findAllPublic(query);
  }

  @Public()
  @Get('breaking')
  @ApiOperation({
    summary: 'Get breaking news headlines (Public & Redis Cached)',
  })
  findBreaking(@Query('limit') limit?: number) {
    return this.articlesService.findBreakingNews(limit ? Number(limit) : 5);
  }

  @Public()
  @Get('featured')
  @ApiOperation({ summary: 'Get featured top stories (Public & Redis Cached)' })
  findFeatured(@Query('limit') limit?: number) {
    return this.articlesService.findFeaturedNews(limit ? Number(limit) : 6);
  }

  @Public()
  @Get(':idOrSlug')
  @ApiOperation({
    summary: 'Get published article details by ID or slug (Public)',
  })
  findOnePublic(@Param('idOrSlug') idOrSlug: string) {
    return this.articlesService.findOneBySlugOrId(idOrSlug, true);
  }

  // --- Authenticated Editorial Endpoints ---

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CHIEF_EDITOR, UserRole.REPORTER)
  @Post()
  @ApiOperation({
    summary: 'Create a new article draft or article (Reporter/Editor/Admin)',
  })
  create(
    @Body() createArticleDto: CreateArticleDto,
    @CurrentUser() user: User,
  ) {
    return this.articlesService.create(createArticleDto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CHIEF_EDITOR, UserRole.REPORTER)
  @Get('editorial/list')
  @ApiOperation({
    summary:
      'Editorial listing (drafts, pending review, published) (Reporter/Editor/Admin)',
  })
  findAllAdmin(@Query() query: QueryArticleDto, @CurrentUser() user: User) {
    return this.articlesService.findAllAdmin(query, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CHIEF_EDITOR, UserRole.REPORTER)
  @Get('editorial/:id')
  @ApiOperation({
    summary:
      'Editorial fetch for any article status by ID (Reporter/Editor/Admin)',
  })
  findOneEditorial(@Param('id') id: string) {
    return this.articlesService.findOneBySlugOrId(id, false);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CHIEF_EDITOR, UserRole.REPORTER)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update article content/metadata (Reporter/Editor/Admin)',
  })
  update(
    @Param('id') id: string,
    @Body() updateArticleDto: UpdateArticleDto,
    @CurrentUser() user: User,
  ) {
    return this.articlesService.update(id, updateArticleDto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CHIEF_EDITOR, UserRole.REPORTER)
  @Patch(':id/status')
  @ApiOperation({
    summary:
      'Update article editorial workflow status (Review, Publish, Archive)',
  })
  updateStatus(
    @Param('id') id: string,
    @Body() statusDto: UpdateArticleStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.articlesService.updateStatus(id, statusDto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CHIEF_EDITOR)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete article (Admin & Chief Editor)' })
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.articlesService.remove(id, user);
  }
}
