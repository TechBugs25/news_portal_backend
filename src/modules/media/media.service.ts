import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Repository } from 'typeorm';
import { EnvConfig } from '../../config/env.validation';
import { User } from '../users/entities/user.entity';
import { Media } from './entities/media.entity';

@Injectable()
export class MediaService {
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {
    this.uploadDir = path.resolve(
      process.cwd(),
      this.configService.get('UPLOAD_DEST'),
    );
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveFile(
    file: Express.Multer.File,
    uploader?: User,
    caption?: string,
  ): Promise<Media> {
    const filename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storagePath = path.join(this.uploadDir, filename);

    await fs.promises.writeFile(storagePath, file.buffer);

    const media = this.mediaRepository.create({
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storagePath,
      url: `/uploads/${filename}`,
      caption,
      uploader,
    });

    return this.mediaRepository.save(media);
  }

  async findAll(): Promise<Media[]> {
    return this.mediaRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['uploader'],
    });
  }

  async findOne(id: string): Promise<Media> {
    const media = await this.mediaRepository.findOne({
      where: { id },
      relations: ['uploader'],
    });
    if (!media) {
      throw new NotFoundException(`Media asset ${id} not found`);
    }
    return media;
  }

  async remove(id: string): Promise<void> {
    const media = await this.findOne(id);
    try {
      if (fs.existsSync(media.storagePath)) {
        await fs.promises.unlink(media.storagePath);
      }
    } catch {
      // Ignore filesystem unlink errors if file was already removed
    }
    await this.mediaRepository.remove(media);
  }
}
