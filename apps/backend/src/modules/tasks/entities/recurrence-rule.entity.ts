import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';
import { RecurrenceFrequency } from '../../../common/enums/recurrence-frequency.enum';

@ObjectType()
@Entity('recurrence_rules')
export class RecurrenceRule {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Field(() => ID)
  @Index({ unique: true })
  @Column({ name: 'series_id', type: 'uuid' })
  seriesId!: string;

  @Field(() => RecurrenceFrequency)
  @Column({ type: 'enum', enum: RecurrenceFrequency })
  frequency!: RecurrenceFrequency;

  @Field(() => Int)
  @Column({ type: 'int', default: 1 })
  interval!: number;

  @Field(() => [Int], { nullable: true })
  @Column({ name: 'days_of_week', type: 'int', array: true, nullable: true })
  daysOfWeek?: number[] | null;

  @Field(() => Int, { nullable: true })
  @Column({ name: 'day_of_month', type: 'int', nullable: true })
  dayOfMonth?: number | null;

  @Field(() => String)
  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Field(() => String, { nullable: true })
  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: string | null;

  @Field(() => String)
  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timezone!: string;

  @Column({ name: 'last_generated_occurrence', type: 'date', nullable: true })
  lastGeneratedOccurrence?: string | null;

  @Field(() => Boolean)
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Field(() => Date)
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Field(() => Date)
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
