import { MigrationInterface, QueryRunner } from 'typeorm';

export class AIConversationsPhaseE1724300000000 implements MigrationInterface {
  name = 'AIConversationsPhaseE1724300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "ai_message_role_enum" AS ENUM ('USER', 'ASSISTANT', 'TOOL')
    `);

    await queryRunner.query(`
      CREATE TABLE "ai_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "title" character varying(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_conversations_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_conversations_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_conversations_user_id_updated_at"
      ON "ai_conversations" ("user_id", "updated_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "ai_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" "ai_message_role_enum" NOT NULL,
        "content" text NOT NULL,
        "tool_name" character varying(128),
        "tool_call_id" character varying(128),
        "tool_status" character varying(64),
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_messages_conversation_id" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ai_messages_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_messages_conversation_id_created_at"
      ON "ai_messages" ("conversation_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ai_messages_user_id_created_at"
      ON "ai_messages" ("user_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_messages_user_id_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_messages_conversation_id_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_messages"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_conversations_user_id_updated_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_conversations"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "ai_message_role_enum"`);
  }
}
