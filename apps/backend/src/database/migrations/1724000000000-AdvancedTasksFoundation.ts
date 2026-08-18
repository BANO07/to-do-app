import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdvancedTasksFoundation1724000000000 implements MigrationInterface {
  name = 'AdvancedTasksFoundation1724000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "iana_timezone" character varying(64) NOT NULL DEFAULT 'UTC'
    `);

    await queryRunner.query(`
      CREATE TYPE "subtask_status_enum" AS ENUM ('TODO', 'COMPLETED')
    `);
    await queryRunner.query(`
      CREATE TYPE "recurrence_frequency_enum" AS ENUM (
        'DAILY', 'WEEKDAYS', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "reminder_channel_enum" AS ENUM ('IN_APP', 'PUSH', 'EMAIL')
    `);

    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN "series_id" uuid,
      ADD COLUMN "occurrence_date" date
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_tasks_series_occurrence"
      ON "tasks" ("series_id", "occurrence_date")
      WHERE "series_id" IS NOT NULL AND "occurrence_date" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_user_id_series_id" ON "tasks" ("user_id", "series_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "subtasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "status" "subtask_status_enum" NOT NULL DEFAULT 'TODO',
        "position" integer NOT NULL DEFAULT 0,
        "completed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subtasks_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subtasks_task_id" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_subtasks_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_subtasks_user_id_task_id" ON "subtasks" ("user_id", "task_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "recurrence_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "series_id" uuid NOT NULL,
        "frequency" "recurrence_frequency_enum" NOT NULL,
        "interval" integer NOT NULL DEFAULT 1,
        "days_of_week" integer[],
        "day_of_month" integer,
        "start_date" date NOT NULL,
        "end_date" date,
        "timezone" character varying(64) NOT NULL DEFAULT 'UTC',
        "last_generated_occurrence" date,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recurrence_rules_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_recurrence_rules_series_id" UNIQUE ("series_id"),
        CONSTRAINT "FK_recurrence_rules_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_recurrence_rules_user_id" ON "recurrence_rules" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "reminders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "task_id" uuid NOT NULL,
        "fire_at" TIMESTAMPTZ NOT NULL,
        "offset_minutes" integer,
        "channel" "reminder_channel_enum" NOT NULL DEFAULT 'IN_APP',
        "sent_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reminders_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reminders_task_id" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reminders_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_reminders_user_id_task_id" ON "reminders" ("user_id", "task_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reminders_fire_at" ON "reminders" ("fire_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reminders_fire_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reminders_user_id_task_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reminders"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_recurrence_rules_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recurrence_rules"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subtasks_user_id_task_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subtasks"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_user_id_series_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tasks_series_occurrence"`);
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN IF EXISTS "occurrence_date"`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN IF EXISTS "series_id"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "reminder_channel_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "recurrence_frequency_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subtask_status_enum"`);

    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "iana_timezone"`,
    );
  }
}
