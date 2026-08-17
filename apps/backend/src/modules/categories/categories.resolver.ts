import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from './dto/category.inputs';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Resolver(() => Category)
@UseGuards(GqlAuthGuard)
export class CategoriesResolver {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Query(() => [Category], { name: 'categories' })
  categories(@CurrentUser() user: User): Promise<Category[]> {
    return this.categoriesService.findAll(user.id);
  }

  @Mutation(() => Category)
  createCategory(
    @CurrentUser() user: User,
    @Args('input') input: CreateCategoryInput,
  ): Promise<Category> {
    return this.categoriesService.create(user.id, input);
  }

  @Mutation(() => Category)
  updateCategory(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCategoryInput,
  ): Promise<Category> {
    return this.categoriesService.update(user.id, id, input);
  }

  @Mutation(() => Boolean)
  deleteCategory(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.categoriesService.delete(user.id, id);
  }
}
