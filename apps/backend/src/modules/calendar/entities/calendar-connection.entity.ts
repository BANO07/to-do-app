import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { CalendarConnectionStatus } from '../../../common/enums/calendar-connection-status.enum';
import { User } from '../../users/entities/user.entity';
import { CalendarEvent } from './calendar-event.entity';

@ObjectType()
@Entity('calendar_connections')
export class CalendarConnection {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 64, default: 'google' })
  provider!: string;

  @Field(() => String, { nullable: true })
  @Column({ name: 'provider_account_id', type: 'varchar', length: 256, nullable: true })
  providerAccountId!: string | null;

  /** Access token — stored encrypted; never exposed via GraphQL */
  @Column({ name: 'access_token', type: 'text' })
  accessToken!: string;

  /** Refresh token — stored encrypted; never exposed via GraphQL */
  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken!: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  tokenExpiresAt!: Date | null;

  @Column({ type: 'text', array: true, default: [] })
  scopes!: string[];

  @Field(() => CalendarConnectionStatus)
  @Column({
    type: 'enum',
    enum: CalendarConnectionStatus,
    default: CalendarConnectionStatus.ACTIVE,
  })
  status!: CalendarConnectionStatus;

  @Field(() => Date)
  @CreateDateColumn({ name: 'connected_at', type: 'timestamptz' })
  connectedAt!: Date;

  @Field(() => Date)
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => CalendarEvent, (event) => event.connection)
  events!: CalendarEvent[];
}
