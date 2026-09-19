import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ArticleStatus } from '../../../common/enums/article-status.enum';
import { Category } from '../../categories/entities/category.entity';
import { Tag } from '../../tags/entities/tag.entity';
import { User } from '../../users/entities/user.entity';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 350 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  excerpt?: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  featuredImageUrl?: string;

  @Column({
    type: 'enum',
    enum: ArticleStatus,
    default: ArticleStatus.DRAFT,
  })
  status: ArticleStatus;

  @ManyToOne(() => User, (user) => user.articles, {
    eager: true,
    onDelete: 'CASCADE',
  })
  author: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  reviewer?: User;

  @ManyToOne(() => Category, (category) => category.articles, {
    eager: true,
    onDelete: 'RESTRICT',
  })
  category: Category;

  @ManyToMany(() => Tag, (tag) => tag.articles, { eager: true, cascade: true })
  @JoinTable({
    name: 'article_tags',
    joinColumn: { name: 'article_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @Index()
  @Column({ type: 'timestamp with time zone', nullable: true })
  publishedAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  scheduledAt?: Date;

  @Column({ type: 'bigint', default: 0 })
  viewCount: number;

  @Index()
  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @Index()
  @Column({ type: 'boolean', default: false })
  isBreaking: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  metaTitle?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  metaDescription?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
