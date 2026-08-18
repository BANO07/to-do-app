import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationsPhaseC1724100000000 implements MigrationInterface {
  name = 'NotificationsPhaseC1724100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "notification_type_enum" AS ENUM ('REMINDER')
    `);
    await queryRunner.query(`
      CREATE TYPE "notification_status_enum" AS ENUM ('PENDING', 'SENT', 'FAILED')
    `);

    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "in_app_enabled" boolean NOT NULL DEFAULT true,
        "email_enabled" boolean NOT NULL DEFAULT true,
        "push_enabled" boolean NOT NULL DEFAULT false,
        "reminder_enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_preferences_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_preferences_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_notification_preferences_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "notification_preferences" (
        "user_id",
        "in_app_enabled",
        "email_enabled",
        "push_enabled",
        "reminder_enabled"
      )
      SELECT
        "id",
        true,
        true,
        false,
        true
      FROM "users"
      ON CONFLICT ("user_id") DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE "push_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_subscriptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_push_subscriptions_endpoint" UNIQUE ("endpoint"),
        CONSTRAINT "FK_push_subscriptions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_push_subscriptions_user_id_created_at"
      ON "push_subscriptions" ("user_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "reminder_id" uuid,
        "task_id" uuid,
        "type" "notification_type_enum" NOT NULL,
        "channel" "reminder_channel_enum" NOT NULL,
        "status" "notification_status_enum" NOT NULL DEFAULT 'PENDING',
        "title" character varying(255) NOT NULL,
        "message" text NOT NULL,
        "scheduled_at" TIMESTAMPTZ,
        "delivered_at" TIMESTAMPTZ,
        "read_at" TIMESTAMPTZ,
        "idempotency_key" character varying(255) NOT NULL,
        "last_error" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notifications_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "FK_notifications_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_notifications_reminder_id" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_notifications_task_id" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_user_id_created_at"
      ON "notifications" ("user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_user_id_read_at"
      ON "notifications" ("user_id", "read_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_status_scheduled_at"
      ON "notifications" ("status", "scheduled_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_reminder_id"
      ON "notifications" ("reminder_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notifications_task_id"
      ON "notifications" ("task_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_task_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_reminder_id"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_status_scheduled_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_user_id_read_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_user_id_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_push_subscriptions_user_id_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "push_subscriptions"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "notification_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_type_enum"`);
  }
}
