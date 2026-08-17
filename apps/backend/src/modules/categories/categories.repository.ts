import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesRepository {
  constructor(
    @InjectRepository(Category)
    private readonly repository: Repository<Category>,
  ) {}

  findAllByUser(userId: string): Promise<Category[]> {
    return this.repository.find({
      where: { userId },
      order: { name: 'ASC' },
    });
  }

  findByIdForUser(id: string, userId: string): Promise<Category | null> {
    return this.repository.findOne({ where: { id, userId } });
  }

  create(data: Partial<Category>): Category {
    return this.repository.create(data);
  }

  save(category: Category): Promise<Category> {
    return this.repository.save(category);
  }

  async remove(category: Category): Promise<void> {
    await this.repository.remove(category);
  }

  countByUser(userId: string): Promise<number> {
    return this.repository.count({ where: { userId } });
  }
}
