import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { User } from '../users/entities/user.entity';
import { MediaService } from './media.service';

@ApiTags('Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.CHIEF_EDITOR, UserRole.REPORTER)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|gif|svg\+xml)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload an image asset' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caption: { type: 'string' },
      },
    },
  })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Body('caption') caption?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.mediaService.saveFile(file, user, caption);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CHIEF_EDITOR, UserRole.REPORTER)
  @ApiOperation({ summary: 'List all media assets' })
  findAll() {
    return this.mediaService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.CHIEF_EDITOR, UserRole.REPORTER)
  @ApiOperation({ summary: 'Get media asset details' })
  findOne(@Param('id') id: string) {
    return this.mediaService.findOne(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.CHIEF_EDITOR)
  @ApiOperation({ summary: 'Delete media asset' })
  remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }
}
