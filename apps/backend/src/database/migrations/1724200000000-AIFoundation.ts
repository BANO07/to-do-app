import { MigrationInterface, QueryRunner } from 'typeorm';

export class AIFoundation1724200000000 implements MigrationInterface {
  name = 'AIFoundation1724200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_usage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "usage_date" date NOT NULL,
        "request_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_usage_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ai_usage_user_id_usage_date" UNIQUE ("user_id", "usage_date"),
        CONSTRAINT "FK_ai_usage_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_usage"`);
  }
}
