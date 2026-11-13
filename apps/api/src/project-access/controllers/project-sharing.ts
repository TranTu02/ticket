import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";
import { publishEvent } from "../../events";

export interface ActiveGroupItem {
  id: string;
  name: string;
  alias?: string | null;
  description?: string | null;
  memberCount: number;
  memberIds: string[];
  members?: Array<{
    id: string;
    userId?: string;
    name: string | null;
    email: string;
  }>;
}

export interface ActiveUserItem {
  id: string;
  userId?: string;
  name: string | null;
  email: string;
  groupId?: string | null;
  groupName?: string | null;
  groupIds?: string[];
  groups?: Array<{ id: string; name: string; isLeader?: boolean }>;
  groupNames?: string;
  roles?: string[];
  status: string;
}

export async function listActiveGroups(): Promise<ActiveGroupItem[]> {
  const result = await db.execute(sql`
    SELECT
      t.id AS id,
      t.name AS name,
      t.member_count AS "memberCount",
      COALESCE(
        (
          SELECT array_agg(tm.user_id)
          FROM public.team_member tm
          WHERE tm.team_id = t.id
        ),
        '{}'::text[]
      ) AS "memberIds",
      COALESCE(
        (
          SELECT json_agg(json_build_object('id', u.id, 'userId', u.id, 'name', u.name, 'email', u.email))
          FROM public.team_member tm
          JOIN public."user" u ON u.id = tm.user_id
          WHERE tm.team_id = t.id
        ),
        '[]'::json
      ) AS members
    FROM public.team t
    WHERE t.workspace_id = 'irdop'
    ORDER BY t.name ASC;
  `);

  return (result.rows as unknown as ActiveGroupItem[]) || [];
}

export async function listActiveUsers(): Promise<ActiveUserItem[]> {
  try {
    const result = await db.execute(sql`
      SELECT
        u.id AS id,
        u.id AS "userId",
        u.name AS name,
        u.email AS email,
        COALESCE(v.groups, '[]'::json) AS groups,
        COALESCE(v.group_ids, '{}') AS "groupIds",
        COALESCE(v.group_names, '') AS "groupNames",
        (CASE WHEN array_length(v.group_ids, 1) > 0 THEN v.group_ids[1] ELSE NULL END) AS "groupId",
        (CASE WHEN v.group_names <> '' THEN split_part(v.group_names, ',', 1) ELSE NULL END) AS "groupName",
        COALESCE(i."identityRoles", '{}') AS roles,
        'active' AS status
      FROM public."user" u
      JOIN public.workspace_member wm ON wm.user_id = u.id AND wm.workspace_id = 'irdop'
      LEFT JOIN public.workspace_members_with_groups_view v ON v.user_id = u.id
      JOIN identity.identities i ON (i."identityId" = u.id OR lower(i.email) = lower(u.email))
      WHERE i."identityStatus" = 'active' AND i."deletedAt" IS NULL
      ORDER BY u.name ASC;
    `);

    if (result.rows && result.rows.length > 0) {
      return result.rows.map((row: any) => ({
        id: row.id,
        userId: row.id,
        name: row.name,
        email: row.email,
        groupId: row.groupId ?? null,
        groupName: row.groupName ?? null,
        groupIds: Array.isArray(row.groupIds) ? row.groupIds : [],
        groups: Array.isArray(row.groups) ? row.groups : [],
        groupNames: row.groupNames || "",
        roles: Array.isArray(row.roles) ? row.roles : [],
        status: row.status || "active",
      }));
    }
  } catch {
    // fallback
  }

  const result = await db.execute(sql`
    SELECT
      u.id AS id,
      u.id AS "userId",
      u.name AS name,
      u.email AS email,
      i."identityGroupId" AS "groupId",
      g."identityGroupName" AS "groupName",
      COALESCE(i."identityGroupIds", ARRAY[i."identityGroupId"]) AS "groupIds",
      COALESCE(i."identityRoles", '{}') AS roles,
      'active' AS status
    FROM public."user" u
    JOIN public.workspace_member wm ON wm.user_id = u.id AND wm.workspace_id = 'irdop'
    JOIN identity.identities i ON (i."identityId" = u.id OR lower(i.email) = lower(u.email))
    LEFT JOIN identity."identityGroups" g ON g."identityGroupId" = i."identityGroupId"
    WHERE i."identityStatus" = 'active' AND i."deletedAt" IS NULL
    ORDER BY u.name ASC;
  `);

  return (result.rows as unknown as ActiveUserItem[]) || [];
}

export async function getProjectShare(
  projectId: string,
  _workspaceId?: string,
) {
  const [project] = await db
    .select({
      id: projectTable.id,
      shareType: projectTable.shareType,
      groupId: projectTable.groupId,
      sharedGroupId: projectTable.sharedGroupId,
      sharedGroupIds: projectTable.sharedGroupIds,
      sharedUserIds: projectTable.sharedUserIds,
    })
    .from(projectTable)
    .where(eq(projectTable.id, projectId));

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const effectiveGroupId =
    project.sharedGroupId ||
    project.groupId ||
    project.sharedGroupIds?.[0] ||
    null;
  const effectiveGroupIds =
    project.sharedGroupIds && project.sharedGroupIds.length > 0
      ? project.sharedGroupIds
      : effectiveGroupId
        ? [effectiveGroupId]
        : [];
  const effectiveUserIds = project.sharedUserIds || [];

  let group: { id: string; name: string; memberCount?: number } | null = null;
  if (effectiveGroupId) {
    const groupResult = await db.execute(sql`
      SELECT id, name, member_count as "memberCount" FROM public.team WHERE id = ${effectiveGroupId} LIMIT 1
    `);
    if (groupResult.rows[0]) {
      group = groupResult.rows[0] as {
        id: string;
        name: string;
        memberCount: number;
      };
    }
  }

  let users: Array<{
    id: string;
    userId?: string;
    name: string | null;
    email: string;
  }> = [];
  if (effectiveUserIds.length > 0) {
    const usersResult = await db.execute(sql`
      SELECT u.id, u.id as "userId", u.name, u.email
      FROM public."user" u
      WHERE u.id = ANY(${effectiveUserIds})
         OR u.email = ANY(${effectiveUserIds})
    `);
    users = usersResult.rows as unknown as Array<{
      id: string;
      userId?: string;
      name: string | null;
      email: string;
    }>;
  }

  return {
    projectId: project.id,
    shareType: project.shareType || "all",
    groupId: effectiveGroupId,
    sharedGroupId: effectiveGroupId,
    sharedGroupIds: effectiveGroupIds,
    sharedUserIds: effectiveUserIds,
    group,
    users,
  };
}

export async function updateProjectShare(
  projectId: string,
  workspaceId: string,
  sharing: {
    shareType: "all" | "group" | "user";
    groupId?: string | null;
    sharedGroupId?: string | null;
    sharedGroupIds?: string[];
    sharedUserIds?: string[];
  },
) {
  const effectiveGroupId =
    sharing.sharedGroupId ||
    sharing.groupId ||
    sharing.sharedGroupIds?.[0] ||
    null;
  const effectiveGroupIds =
    sharing.sharedGroupIds && sharing.sharedGroupIds.length > 0
      ? sharing.sharedGroupIds
      : effectiveGroupId
        ? [effectiveGroupId]
        : [];
  const effectiveUserIds = sharing.sharedUserIds || [];

  const [updated] = await db
    .update(projectTable)
    .set({
      shareType: sharing.shareType,
      groupId: effectiveGroupId,
      sharedGroupId: effectiveGroupId,
      sharedGroupIds: effectiveGroupIds,
      sharedUserIds: effectiveUserIds,
    })
    .where(eq(projectTable.id, projectId))
    .returning();

  if (!updated) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  if (effectiveGroupId) {
    await db.execute(sql`
      INSERT INTO public.project_group (id, workspace_id, project_id, group_id)
      VALUES (${`pg_${projectId}_${effectiveGroupId}`}, ${workspaceId}, ${projectId}, ${effectiveGroupId})
      ON CONFLICT (project_id, group_id) DO NOTHING
    `);
  }

  if (sharing.shareType === "user" && effectiveUserIds.length > 0) {
    for (const uid of effectiveUserIds) {
      await db.execute(sql`
        INSERT INTO workspace_member_project (id, workspace_id, user_id, project_id)
        VALUES (${`wmp_${projectId}_${uid}`}, ${workspaceId}, ${uid}, ${projectId})
        ON CONFLICT DO NOTHING
      `);
    }
  }

  await publishEvent("project.updated", { projectId });

  return {
    projectId,
    shareType: sharing.shareType,
    groupId: effectiveGroupId,
    sharedGroupId: effectiveGroupId,
    sharedGroupIds: effectiveGroupIds,
    sharedUserIds: effectiveUserIds,
  };
}
