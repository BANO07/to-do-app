import { Resolver, Query, Mutation } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class AuthPayload {
  @Field(() => Boolean)
  success!: boolean;
}

@Resolver()
export class AuthResolver {
  @Query(() => User, { name: 'me', nullable: true })
  @UseGuards(GqlAuthGuard)
  me(@CurrentUser() user: User): User {
    return user;
  }

  @Mutation(() => AuthPayload)
  logout(): AuthPayload {
    // Cookie cleared via REST /auth/logout from frontend
    return { success: true };
  }
}
