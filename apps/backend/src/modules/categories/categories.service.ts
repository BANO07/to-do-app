import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CategoriesRepository } from './categories.repository';
import { Category } from './entities/category.entity';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from './dto/category.inputs';

const DEFAULT_CATEGORIES = [
  { name: 'Work', icon: '💼', description: 'Work-related tasks' },
  { name: 'Personal', icon: '🏠', description: 'Personal life tasks' },
  { name: 'Learning', icon: '📚', description: 'Learning and growth' },
  { name: 'Fitness', icon: '💪', description: 'Health and fitness' },
  { name: 'Shopping', icon: '🛒', description: 'Shopping lists' },
  { name: 'Projects', icon: '🚀', description: 'Side projects' },
];

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  findAll(userId: string): Promise<Category[]> {
    return this.categoriesRepository.findAllByUser(userId);
  }

  async findById(userId: string, id: string): Promise<Category> {
    const category = await this.categoriesRepository.findByIdForUser(id, userId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    const category = this.categoriesRepository.create({ ...input, userId });
    try {
      return await this.categoriesRepository.save(category);
    } catch {
      throw new ConflictException('A category with this name already exists');
    }
  }

  async update(
    userId: string,
    id: string,
    input: UpdateCategoryInput,
  ): Promise<Category> {
    const category = await this.findById(userId, id);
    Object.assign(category, input);
    try {
      return await this.categoriesRepository.save(category);
    } catch {
      throw new ConflictException('A category with this name already exists');
    }
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const category = await this.findById(userId, id);
    await this.categoriesRepository.remove(category);
    return true;
  }

  async seedDefaultsForUser(userId: string): Promise<void> {
    const count = await this.categoriesRepository.countByUser(userId);
    if (count > 0) {
      return;
    }

    for (const item of DEFAULT_CATEGORIES) {
      const category = this.categoriesRepository.create({ ...item, userId });
      await this.categoriesRepository.save(category);
    }
  }
}
