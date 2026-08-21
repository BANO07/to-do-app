import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskGoogleEventId1724600000000 implements MigrationInterface {
  name = 'TaskGoogleEventId1724600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tasks"
      ADD COLUMN "google_event_id" character varying(512)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_tasks_user_google_event_id"
      ON "tasks" ("user_id", "google_event_id")
      WHERE "google_event_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tasks_user_google_event_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "tasks"
      DROP COLUMN IF EXISTS "google_event_id"
    `);
  }
}
