import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Task } from '../../tasks/entities/task.entity';
import { Category } from '../../categories/entities/category.entity';

@ObjectType()
@Entity('users')
export class User {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'google_id', type: 'varchar', length: 255 })
  googleId!: string;

  @Field(() => String)
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Field(() => String)
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Field(() => String, { nullable: true })
  @Column({ name: 'avatar_url', type: 'varchar', length: 512, nullable: true })
  avatarUrl?: string | null;

  @Field(() => Date)
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Field(() => Date)
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  @Field(() => String)
  @Column({ name: 'iana_timezone', type: 'varchar', length: 64, default: 'UTC' })
  ianaTimezone!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => Task, (task) => task.user)
  tasks!: Task[];

  @OneToMany(() => Category, (category) => category.user)
  categories!: Category[];
}
