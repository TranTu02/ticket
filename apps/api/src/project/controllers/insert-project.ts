import { eq, sql } from "drizzle-orm";
import type db from "../../database";
import { columnTable, projectTable } from "../../database/schema";
import { grantProjectToRestrictedMember } from "../../project-access/grant-project-to-restricted-member";
import {
  assertProjectKeyAvailable,
  lockProjectOrdering,
  nextProjectPosition,
} from "./project-placement";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type NewProject = {
  workspaceId: string;
  name: string;
  icon: string;
  slug: string;
  userId: string;
  shareType?: "all" | "group" | "user";
  groupId?: string | null;
  sharedGroupId?: string | null;
  sharedGroupIds?: string[];
  sharedUserIds?: string[];
};

export type ProjectPlacement = {
  workspaceId: string;
  projectId: string;
  slug: string;
};

export const DEFAULT_PROJECT_COLUMNS = [
  { name: "To Do", slug: "to-do", position: 0, isFinal: false },
  { name: "In Progress", slug: "in-progress", position: 1, isFinal: false },
  { name: "In Review", slug: "in-review", position: 2, isFinal: false },
  { name: "Done", slug: "done", position: 3, isFinal: true },
] as const;

async function seedDefaultColumns(tx: Transaction, projectId: string) {
  for (const col of DEFAULT_PROJECT_COLUMNS) {
    await tx.insert(columnTable).values({
      projectId,
      name: col.name,
      slug: col.slug,
      position: col.position,
      isFinal: col.isFinal,
    });
  }
}

export async function insertProject(
  tx: Transaction,
  {
    workspaceId,
    name,
    icon,
    slug,
    userId,
    shareType,
    groupId,
    sharedGroupId,
    sharedGroupIds,
    sharedUserIds,
  }: NewProject,
) {
  // Serialize ordering writes per workspace: without this, two concurrent
  // creates can read the same max(position) and land on the same slot, and a
  // create can interleave with a reorder's renumber. `reorderProjects` takes
  // the same lock with the same key.
  await lockProjectOrdering(tx, workspaceId);
  await assertProjectKeyAvailable(tx, workspaceId, slug);

  // New projects go to the bottom of the workspace's ordering.
  const position = await nextProjectPosition(tx, workspaceId);

  const effectiveGroupId =
    sharedGroupId || groupId || sharedGroupIds?.[0] || null;
  const effectiveGroupIds =
    sharedGroupIds || (effectiveGroupId ? [effectiveGroupId] : []);
  const effectiveUserIds = sharedUserIds || [];

  const [createdProject] = await tx
    .insert(projectTable)
    .values({
      workspaceId,
      name,
      icon,
      slug,
      position,
      shareType: shareType || "all",
      groupId: effectiveGroupId,
      sharedGroupId: effectiveGroupId,
      sharedGroupIds: effectiveGroupIds,
      sharedUserIds: effectiveUserIds,
    })
    .returning();

  if (createdProject) {
    await seedDefaultColumns(tx, createdProject.id);
    await grantProjectToRestrictedMember(tx, {
      workspaceId,
      userId,
      projectId: createdProject.id,
    });

    if (effectiveGroupId) {
      await tx.execute(
        sql`INSERT INTO public.project_group (id, workspace_id, project_id, group_id)
            VALUES (${`pg_${createdProject.id}_${effectiveGroupId}`}, ${workspaceId}, ${createdProject.id}, ${effectiveGroupId})
            ON CONFLICT (project_id, group_id) DO NOTHING`,
      );
    }

    if (shareType === "user" && effectiveUserIds.length > 0) {
      for (const uid of effectiveUserIds) {
        await tx.execute(
          sql`INSERT INTO workspace_member_project (id, workspace_id, user_id, project_id)
              VALUES (${`wmp_${createdProject.id}_${uid}`}, ${workspaceId}, ${uid}, ${createdProject.id})
              ON CONFLICT DO NOTHING`,
        );
      }
    }
  }

  return createdProject;
}

export async function insertUnplacedProject(
  tx: Transaction,
  {
    workspaceId,
    name,
    icon,
    slug,
    userId,
    shareType,
    groupId,
    sharedGroupId,
    sharedGroupIds,
    sharedUserIds,
  }: NewProject,
) {
  const effectiveGroupId =
    sharedGroupId || groupId || sharedGroupIds?.[0] || null;
  const effectiveGroupIds =
    sharedGroupIds || (effectiveGroupId ? [effectiveGroupId] : []);
  const effectiveUserIds = sharedUserIds || [];

  const [createdProject] = await tx
    .insert(projectTable)
    .values({
      workspaceId,
      name,
      icon,
      slug,
      position: 0,
      shareType: shareType || "all",
      groupId: effectiveGroupId,
      sharedGroupId: effectiveGroupId,
      sharedGroupIds: effectiveGroupIds,
      sharedUserIds: effectiveUserIds,
    })
    .returning();

  if (createdProject) {
    await seedDefaultColumns(tx, createdProject.id);
    await grantProjectToRestrictedMember(tx, {
      workspaceId,
      userId,
      projectId: createdProject.id,
    });

    if (effectiveGroupId) {
      await tx.execute(
        sql`INSERT INTO public.project_group (id, workspace_id, project_id, group_id)
            VALUES (${`pg_${createdProject.id}_${effectiveGroupId}`}, ${workspaceId}, ${createdProject.id}, ${effectiveGroupId})
            ON CONFLICT (project_id, group_id) DO NOTHING`,
      );
    }

    if (shareType === "user" && effectiveUserIds.length > 0) {
      for (const uid of effectiveUserIds) {
        await tx.execute(
          sql`INSERT INTO workspace_member_project (id, workspace_id, user_id, project_id)
              VALUES (${`wmp_${createdProject.id}_${uid}`}, ${workspaceId}, ${uid}, ${createdProject.id})
              ON CONFLICT DO NOTHING`,
        );
      }
    }
  }

  return createdProject;
}

export async function placeProject(
  tx: Transaction,
  { workspaceId, projectId, slug }: ProjectPlacement,
) {
  await lockProjectOrdering(tx, workspaceId);
  await assertProjectKeyAvailable(tx, workspaceId, slug, projectId);
  const position = await nextProjectPosition(tx, workspaceId, projectId);

  await tx
    .update(projectTable)
    .set({ position })
    .where(eq(projectTable.id, projectId));
}
