import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiAttachmentsPhaseH1724400000000 implements MigrationInterface {
  name = 'AiAttachmentsPhaseH1724400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "ai_attachment_status_enum" AS ENUM ('UPLOADING', 'READY', 'FAILED', 'DELETED')
    `);

    await queryRunner.query(`
      CREATE TABLE "ai_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "original_filename" character varying(512) NOT NULL,
        "storage_key" character varying(1024) NOT NULL,
        "mime_type" character varying(128) NOT NULL,
        "size_bytes" bigint NOT NULL,
        "status" "ai_attachment_status_enum" NOT NULL DEFAULT 'UPLOADING',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_attachments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ai_attachments_storage_key" UNIQUE ("storage_key"),
        CONSTRAINT "FK_ai_attachments_conversation_id"
          FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ai_attachments_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_ai_attachments_conversation_id_created_at"
      ON "ai_attachments" ("conversation_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_attachments_user_id_created_at"
      ON "ai_attachments" ("user_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_attachments_user_id_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_attachments_conversation_id_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_attachments"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ai_attachment_status_enum"`);
  }
}
