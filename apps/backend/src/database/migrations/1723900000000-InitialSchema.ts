import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1723900000000 implements MigrationInterface {
  name = 'InitialSchema1723900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TYPE "task_status_enum" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED')
    `);
    await queryRunner.query(`
      CREATE TYPE "task_priority_enum" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "google_id" character varying(255) NOT NULL,
        "email" character varying(255) NOT NULL,
        "name" character varying(255) NOT NULL,
        "avatar_url" character varying(512),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "last_login_at" TIMESTAMPTZ,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_google_id" UNIQUE ("google_id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "description" text,
        "icon" character varying(50),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_categories_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_categories_user_name" UNIQUE ("user_id", "name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "status" "task_status_enum" NOT NULL DEFAULT 'TODO',
        "priority" "task_priority_enum" NOT NULL DEFAULT 'MEDIUM',
        "due_date" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "category_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tasks_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tasks_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tasks_category_id" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_categories_user_id" ON "categories" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_user_id_status" ON "tasks" ("user_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_user_id_due_date" ON "tasks" ("user_id", "due_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_user_id_category_id" ON "tasks" ("user_id", "category_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_user_id_created_at" ON "tasks" ("user_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_tasks_user_id_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_user_id_category_id"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_user_id_due_date"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_user_id_status"`);
    await queryRunner.query(`DROP INDEX "IDX_categories_user_id"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "task_priority_enum"`);
    await queryRunner.query(`DROP TYPE "task_status_enum"`);
  }
}
