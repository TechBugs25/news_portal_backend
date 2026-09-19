import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTagDto } from './dto/create-tag.dto';
import { Tag } from './entities/tag.entity';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {}

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async create(createTagDto: CreateTagDto): Promise<Tag> {
    const slug = createTagDto.slug
      ? this.generateSlug(createTagDto.slug)
      : this.generateSlug(createTagDto.name);

    const existing = await this.tagRepository.findOne({ where: { slug } });
    if (existing) {
      return existing;
    }

    const tag = this.tagRepository.create({
      name: createTagDto.name,
      slug,
    });

    return this.tagRepository.save(tag);
  }

  async findAll(): Promise<Tag[]> {
    return this.tagRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(idOrSlug: string): Promise<Tag> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSlug,
      );
    const tag = await this.tagRepository.findOne({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
    });

    if (!tag) {
      throw new NotFoundException(`Tag "${idOrSlug}" not found`);
    }
    return tag;
  }

  async findOrCreateMany(names: string[]): Promise<Tag[]> {
    if (!names || names.length === 0) return [];

    const tags: Tag[] = [];
    for (const name of names) {
      const slug = this.generateSlug(name);
      let tag = await this.tagRepository.findOne({ where: { slug } });
      if (!tag) {
        tag = await this.tagRepository.save(
          this.tagRepository.create({ name: name.trim(), slug }),
        );
      }
      tags.push(tag);
    }
    return tags;
  }

  async remove(id: string): Promise<void> {
    const tag = await this.findOne(id);
    await this.tagRepository.remove(tag);
  }
}
