import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';
import { Category } from '../../categories/entities/category.entity';
import { TaskStatus } from '../../../common/enums/task-status.enum';
import { TaskPriority } from '../../../common/enums/task-priority.enum';
import { Subtask } from './subtask.entity';
import { Reminder } from './reminder.entity';
import { RecurrenceRule } from './recurrence-rule.entity';
import { TaskProgress } from '../dto/task-progress.dto';

@ObjectType()
@Entity('tasks')
@Index(['userId', 'status'])
@Index(['userId', 'dueDate'])
@Index(['userId', 'categoryId'])
@Index(['userId', 'createdAt'])
export class Task {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Field(() => TaskStatus)
  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.TODO })
  status!: TaskStatus;

  @Field(() => TaskPriority)
  @Column({ type: 'enum', enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority!: TaskPriority;

  @Field(() => Date, { nullable: true })
  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate?: Date | null;

  @Field(() => Date, { nullable: true })
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId?: string | null;

  @Field(() => ID, { nullable: true })
  @Column({ name: 'series_id', type: 'uuid', nullable: true })
  seriesId?: string | null;

  @Field(() => String, { nullable: true })
  @Column({ name: 'occurrence_date', type: 'date', nullable: true })
  occurrenceDate?: string | null;

  @Field(() => Date)
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Field(() => Date)
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Field(() => Category, { nullable: true })
  @ManyToOne(() => Category, (category) => category.tasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category?: Category | null;

  @OneToMany(() => Subtask, (subtask) => subtask.task)
  subtasks?: Subtask[];

  @OneToMany(() => Reminder, (reminder) => reminder.task)
  reminders?: Reminder[];

  @Field(() => TaskProgress)
  progress!: TaskProgress;

  @Field(() => RecurrenceRule, { nullable: true })
  recurrence?: RecurrenceRule | null;
}
