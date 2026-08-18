import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';
import { Reminder } from '../../tasks/entities/reminder.entity';
import { Task } from '../../tasks/entities/task.entity';
import { NotificationType } from '../../../common/enums/notification-type.enum';
import { ReminderChannel } from '../../../common/enums/reminder-channel.enum';
import { NotificationStatus } from '../../../common/enums/notification-status.enum';

@ObjectType()
@Entity('notifications')
@Index(['userId', 'createdAt'])
@Index(['userId', 'readAt'])
@Index(['status', 'scheduledAt'])
@Index(['reminderId'])
@Index(['taskId'])
@Index(['idempotencyKey'], { unique: true })
export class Notification {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'reminder_id', type: 'uuid', nullable: true })
  reminderId?: string | null;

  @Field(() => ID, { nullable: true })
  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId?: string | null;

  @Field(() => NotificationType)
  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Field(() => ReminderChannel)
  @Column({ type: 'enum', enum: ReminderChannel })
  channel!: ReminderChannel;

  @Field(() => NotificationStatus)
  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status!: NotificationStatus;

  @Field(() => String)
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Field(() => String)
  @Column({ type: 'text' })
  message!: string;

  @Field(() => Date, { nullable: true })
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt?: Date | null;

  @Field(() => Date, { nullable: true })
  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt?: Date | null;

  @Field(() => Date, { nullable: true })
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey!: string;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @Field(() => Date)
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Field(() => Date)
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Reminder, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reminder_id' })
  reminder?: Reminder | null;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'task_id' })
  task?: Task | null;
}
