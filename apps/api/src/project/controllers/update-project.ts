import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import {
  findProjectKeyConflict,
  isSameProjectKey,
  projectKeyTakenMessage,
} from "../project-key";

async function updateProject(
  id: string,
  name: string,
  icon: string,
  slug: string,
  description: string,
  isPublic: boolean,
  workspaceId: string,
  canShare: boolean,
  includeSubtasks?: boolean,
  sharing?: {
    shareType?: "all" | "group" | "user";
    groupId?: string | null;
    sharedGroupId?: string | null;
    sharedGroupIds?: string[];
    sharedUserIds?: string[];
  },
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(1524, hashtext(${workspaceId}))`,
    );

    const [existingProject] = await tx
      .select()
      .from(projectTable)
      .where(
        and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
      )
      .for("update");

    if (!existingProject) {
      throw new HTTPException(404, {
        message:
          "Project doesn't exist or doesn't belong to the specified workspace",
      });
    }

    if (isPublic !== existingProject.isPublic && !canShare) {
      throw new HTTPException(403, {
        message:
          "Changing project visibility requires the project:share permission",
      });
    }

    if (!isSameProjectKey(slug, existingProject.slug)) {
      const keyConflict = await findProjectKeyConflict(tx, workspaceId, slug, {
        excludeProjectId: id,
      });
      if (keyConflict) {
        throw new HTTPException(409, {
          message: projectKeyTakenMessage(slug, keyConflict.name),
        });
      }
    }

    const effectiveGroupId =
      sharing?.sharedGroupId !== undefined
        ? sharing.sharedGroupId
        : sharing?.groupId !== undefined
          ? sharing.groupId
          : sharing?.sharedGroupIds?.[0];

    const effectiveGroupIds =
      sharing?.sharedGroupIds !== undefined
        ? sharing.sharedGroupIds
        : effectiveGroupId
          ? [effectiveGroupId]
          : undefined;

    const effectiveUserIds = sharing?.sharedUserIds;

    const setPayload: Record<string, unknown> = {
      name,
      icon,
      slug,
      description,
      isPublic,
      ...(includeSubtasks === undefined ? {} : { includeSubtasks }),
    };

    if (sharing?.shareType !== undefined) {
      setPayload.shareType = sharing.shareType;
    }
    if (effectiveGroupId !== undefined) {
      setPayload.groupId = effectiveGroupId;
      setPayload.sharedGroupId = effectiveGroupId;
    }
    if (effectiveGroupIds !== undefined) {
      setPayload.sharedGroupIds = effectiveGroupIds;
    }
    if (effectiveUserIds !== undefined) {
      setPayload.sharedUserIds = effectiveUserIds;
    }

    const [updatedProject] = await tx
      .update(projectTable)
      .set(setPayload)
      .where(eq(projectTable.id, id))
      .returning();

    if (effectiveGroupId) {
      await tx.execute(
        sql`INSERT INTO public.project_group (id, workspace_id, project_id, group_id)
            VALUES (${`pg_${id}_${effectiveGroupId}`}, ${workspaceId}, ${id}, ${effectiveGroupId})
            ON CONFLICT (project_id, group_id) DO NOTHING`,
      );
    }

    if (sharing?.shareType === "user" && effectiveUserIds && effectiveUserIds.length > 0) {
      for (const uid of effectiveUserIds) {
        await tx.execute(
          sql`INSERT INTO workspace_member_project (id, workspace_id, user_id, project_id)
              VALUES (${`wmp_${id}_${uid}`}, ${workspaceId}, ${uid}, ${id})
              ON CONFLICT DO NOTHING`,
        );
      }
    }

    return updatedProject;
  });
}

export default updateProject;
