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
import { Task } from './task.entity';
import { ReminderChannel } from '../../../common/enums/reminder-channel.enum';

@ObjectType()
@Entity('reminders')
@Index(['userId', 'taskId'])
export class Reminder {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Field(() => ID)
  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: string;

  @Field(() => Date)
  @Column({ name: 'fire_at', type: 'timestamptz' })
  fireAt!: Date;

  @Field(() => Int, { nullable: true })
  @Column({ name: 'offset_minutes', type: 'int', nullable: true })
  offsetMinutes?: number | null;

  @Field(() => ReminderChannel)
  @Column({ type: 'enum', enum: ReminderChannel, default: ReminderChannel.IN_APP })
  channel!: ReminderChannel;

  @Field(() => Date, { nullable: true })
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @Field(() => Date)
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Field(() => Date)
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Task, (task) => task.reminders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;
}
