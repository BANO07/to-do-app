import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardSummary } from './dto/dashboard-summary.dto';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Resolver()
@UseGuards(GqlAuthGuard)
export class DashboardResolver {
  constructor(private readonly dashboardService: DashboardService) {}

  @Query(() => DashboardSummary, { name: 'dashboardSummary' })
  dashboardSummary(@CurrentUser() user: User): Promise<DashboardSummary> {
    return this.dashboardService.getSummary(user.id, user.ianaTimezone);
  }
}
