import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoogleCalendarIntegration1724500000000
  implements MigrationInterface
{
  name = 'GoogleCalendarIntegration1724500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "calendar_connection_status_enum" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED')
    `);

    await queryRunner.query(`
      CREATE TABLE "calendar_connections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "provider" character varying(64) NOT NULL DEFAULT 'google',
        "provider_account_id" character varying(256),
        "access_token" text NOT NULL,
        "refresh_token" text,
        "token_expires_at" TIMESTAMPTZ,
        "scopes" text[] NOT NULL DEFAULT '{}',
        "status" "calendar_connection_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "connected_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_calendar_connections_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_calendar_connections_user_provider" UNIQUE ("user_id", "provider"),
        CONSTRAINT "FK_calendar_connections_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_calendar_connections_user_id"
      ON "calendar_connections" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TYPE "calendar_event_status_enum" AS ENUM ('CONFIRMED', 'TENTATIVE', 'CANCELLED')
    `);

    await queryRunner.query(`
      CREATE TABLE "calendar_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "connection_id" uuid NOT NULL,
        "provider_event_id" character varying(512) NOT NULL,
        "calendar_id" character varying(512) NOT NULL DEFAULT 'primary',
        "title" character varying(1024) NOT NULL DEFAULT '(No title)',
        "description" text,
        "start_at" TIMESTAMPTZ NOT NULL,
        "end_at" TIMESTAMPTZ NOT NULL,
        "is_all_day" boolean NOT NULL DEFAULT false,
        "timezone" character varying(128),
        "location" character varying(1024),
        "status" "calendar_event_status_enum" NOT NULL DEFAULT 'CONFIRMED',
        "recurrence_id" character varying(512),
        "synced_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_calendar_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_calendar_events_connection_provider"
          UNIQUE ("connection_id", "provider_event_id"),
        CONSTRAINT "FK_calendar_events_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_calendar_events_connection_id"
          FOREIGN KEY ("connection_id") REFERENCES "calendar_connections"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_calendar_events_user_id_start_at"
      ON "calendar_events" ("user_id", "start_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_calendar_events_connection_id_synced_at"
      ON "calendar_events" ("connection_id", "synced_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_calendar_events_connection_id_synced_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_calendar_events_user_id_start_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_events"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "calendar_event_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_calendar_connections_user_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_connections"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "calendar_connection_status_enum"`,
    );
  }
}
