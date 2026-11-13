import { sql } from "drizzle-orm";
import db from "../database";

export async function migrateProjectSharingColumns() {
  try {
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'project'
      ) AS exists;
    `);

    const exists =
      tableExists.rows[0]?.exists === true ||
      tableExists.rows[0]?.exists === "t";
    if (!exists) return;

    await db.execute(sql`
      ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "share_type" text DEFAULT 'all';
      ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "group_id" text;
      ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "shared_group_id" text;
      ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "shared_group_ids" text[] DEFAULT '{}'::text[];
      ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "shared_user_ids" text[] DEFAULT '{}'::text[];
    `);

    await db.execute(sql`
      ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "assignee_ids" text[] DEFAULT '{}'::text[];
      UPDATE "task" SET "assignee_ids" = '{}'::text[] WHERE "assignee_ids" IS NULL;
      ALTER TABLE "task" ALTER COLUMN "assignee_ids" SET DEFAULT '{}'::text[];
      ALTER TABLE "task" ALTER COLUMN "assignee_ids" SET NOT NULL;
      UPDATE "task" SET "assignee_ids" = ARRAY["assignee_id"] WHERE "assignee_id" IS NOT NULL AND cardinality(COALESCE("assignee_ids", '{}'::text[])) = 0;
      UPDATE "task" SET "share_type" = CASE WHEN "share_type" = 'all' OR "share_type" IS NULL THEN 'public' ELSE 'private' END
      WHERE "share_type" NOT IN ('public', 'private') OR "share_type" IS NULL;
      UPDATE "task" SET "shared_group_ids" = ARRAY["shared_group_id"]
      WHERE "shared_group_id" IS NOT NULL AND cardinality(COALESCE("shared_group_ids", '{}'::text[])) = 0;
    `);
  } catch (error) {
    console.error("Failed to migrate sharing and assignment columns:", error);
  }
}
