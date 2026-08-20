import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { CalendarEventStatus } from '../../../common/enums/calendar-event-status.enum';
import { User } from '../../users/entities/user.entity';
import { CalendarConnection } from './calendar-connection.entity';

@ObjectType()
@Entity('calendar_events')
export class CalendarEvent {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId!: string;

  @Field(() => String)
  @Column({ name: 'provider_event_id', type: 'varchar', length: 512 })
  providerEventId!: string;

  @Field(() => String)
  @Column({ name: 'calendar_id', type: 'varchar', length: 512, default: 'primary' })
  calendarId!: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 1024, default: '(No title)' })
  title!: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Field(() => Date)
  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt!: Date;

  @Field(() => Date)
  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt!: Date;

  @Field(() => Boolean)
  @Column({ name: 'is_all_day', type: 'boolean', default: false })
  isAllDay!: boolean;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 128, nullable: true })
  timezone!: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', length: 1024, nullable: true })
  location!: string | null;

  @Field(() => CalendarEventStatus)
  @Column({
    type: 'enum',
    enum: CalendarEventStatus,
    default: CalendarEventStatus.CONFIRMED,
  })
  status!: CalendarEventStatus;

  @Field(() => String, { nullable: true })
  @Column({ name: 'recurrence_id', type: 'varchar', length: 512, nullable: true })
  recurrenceId!: string | null;

  @Field(() => Date)
  @Column({ name: 'synced_at', type: 'timestamptz', default: () => 'now()' })
  syncedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => CalendarConnection, (conn) => conn.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id' })
  connection!: CalendarConnection;
}
