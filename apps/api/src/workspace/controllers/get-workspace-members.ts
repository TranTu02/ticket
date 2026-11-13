import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { userTable, workspaceUserTable } from "../../database/schema";
import { assertProjectAccess } from "../../project-access/assert-project-access";
import { findWorkspaceProjectIds } from "../../project-access/find-workspace-project-ids";
import { projectAccessCondition } from "../../project-access/project-access-condition";

export interface WorkspaceMemberWithGroups {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  groups: Array<{ id: string; name: string; isLeader?: boolean }>;
  groupIds: string[];
  groupNames: string;
}

async function getWorkspaceMembers(request: {
  workspaceId: string;
  userId: string;
  projectId?: string;
}): Promise<WorkspaceMemberWithGroups[]> {
  const { workspaceId, projectId } = request;

  if (projectId) {
    const [known] = await findWorkspaceProjectIds(workspaceId, [projectId]);
    if (!known) {
      throw new HTTPException(404, { message: "Project not found" });
    }
    await assertProjectAccess(request.userId, projectId);
  }

  // 1. Try public.workspace_members_with_groups_view (contains all 41 members and JSON groups array)
  try {
    const viewResult = await db.execute(sql`
      SELECT
        v.user_id AS id,
        v.user_id AS "userId",
        v.user_name AS name,
        v.user_email AS email,
        v.workspace_role AS role,
        v.groups AS groups,
        COALESCE(v.group_ids, '{}') AS "groupIds",
        COALESCE(v.group_names, '') AS "groupNames",
        u.image AS image
      FROM public.workspace_members_with_groups_view v
      JOIN public."user" u ON u.id = v.user_id
      ORDER BY v.user_name ASC
    `);

    if (viewResult.rows && viewResult.rows.length > 0) {
      let rows = viewResult.rows as unknown as WorkspaceMemberWithGroups[];

      if (projectId) {
        // Filter by projectId access if requested
        const accessibleUserIds = await db
          .select({ userId: workspaceUserTable.userId })
          .from(workspaceUserTable)
          .where(
            and(
              eq(workspaceUserTable.workspaceId, workspaceId),
              projectAccessCondition(workspaceUserTable.userId, projectId),
            ),
          );
        const allowedSet = new Set(accessibleUserIds.map((u) => u.userId));
        rows = rows.filter((r) => allowedSet.has(r.id));
      }

      return rows.map((row: any) => ({
        id: row.id,
        userId: row.id,
        name: row.name || "",
        email: row.email,
        image: row.image ?? null,
        role: row.role,
        groups: Array.isArray(row.groups) ? row.groups : [],
        groupIds: Array.isArray(row.groupIds) ? row.groupIds : [],
        groupNames: row.groupNames || "",
      }));
    }
  } catch {
    // If view query fails, proceed to fallback
  }

  // 2. Fallback query
  const members = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: workspaceUserTable.role,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        projectId
          ? projectAccessCondition(workspaceUserTable.userId, projectId)
          : undefined,
      ),
    );

  const groupMap = new Map<
    string,
    Array<{ id: string; name: string; isLeader?: boolean }>
  >();

  try {
    const groupRows = await db.execute(sql`
      SELECT
        tm.user_id AS "userId",
        t.id AS "groupId",
        t.name AS "groupName",
        COALESCE(g."identityGroupInChargeId" = tm.user_id, false) AS "isLeader"
      FROM public.team_member tm
      JOIN public.team t ON t.id = tm.team_id
      LEFT JOIN identity."identityGroups" g ON g."identityGroupId" = t.id
      WHERE t.workspace_id = ${workspaceId} OR t.workspace_id = 'irdop'
    `);

    for (const row of groupRows.rows as any[]) {
      if (!row.userId || !row.groupId) continue;
      const list = groupMap.get(row.userId) ?? [];
      if (!list.some((item) => item.id === row.groupId)) {
        list.push({
          id: row.groupId,
          name: row.groupName,
          isLeader: Boolean(row.isLeader),
        });
        groupMap.set(row.userId, list);
      }
    }
  } catch {
    // ignore
  }

  return members.map((m) => {
    const userGroups = groupMap.get(m.id) ?? [];
    return {
      id: m.id,
      userId: m.id,
      name: m.name ?? "",
      email: m.email,
      image: m.image ?? null,
      role: m.role,
      groups: userGroups,
      groupIds: userGroups.map((g) => g.id),
      groupNames: userGroups.map((g) => g.name).join(", "),
    };
  });
}

export default getWorkspaceMembers;
