import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { teamMemberTable } from "../database/schema";

export interface TaskAccessFields {
  creatorId?: string | null;
  createdBy?: string | null;
  userId?: string | null;
  assigneeIds?: string[] | null;
  shareType?: string | null;
  sharedGroupId?: string | null;
  sharedGroupIds?: string[] | null;
  sharedUserIds?: string[] | null;
  workspaceId?: string | null;
}

export async function canUserAccessTask(
  task: TaskAccessFields,
  userId?: string,
): Promise<boolean> {
  if (!userId) return true;

  // 1. Creator or assignee always has access
  if (
    task.creatorId === userId ||
    task.createdBy === userId ||
    task.userId === userId ||
    task.assigneeIds?.includes(userId)
  ) {
    return true;
  }

  // Legacy task rows with all/group/user retain their prior visibility.
  const shareType = task.shareType || "public";
  if (shareType === "public" || shareType === "all") {
    return true;
  }

  // 3. Instance admin / Workspace owner bypass
  try {
    const res = await db.execute(sql`
      SELECT u.role, wm.role as "workspaceRole"
      FROM public."user" u
      LEFT JOIN public.workspace_member wm ON wm.user_id = u.id AND wm.workspace_id = 'irdop'
      WHERE u.id = ${userId}
      LIMIT 1
    `);
    const userRow = res.rows?.[0] as any;
    if (
      userRow?.role === "admin" ||
      userRow?.workspaceRole === "owner" ||
      userRow?.workspaceRole === "admin"
    ) {
      return true;
    }
  } catch {
    // ignore
  }

  // Private tasks and explicit additions to public tasks can be shared with
  // people and groups independently.
  if (task.sharedUserIds?.includes(userId)) return true;
  const groupIds = [
    ...(task.sharedGroupIds || []),
    ...(task.sharedGroupId ? [task.sharedGroupId] : []),
  ];
  if (groupIds.length === 0) return false;

  try {
    const members = await db
      .select({ userId: teamMemberTable.userId })
      .from(teamMemberTable)
      .where(
        and(
          eq(teamMemberTable.userId, userId),
          inArray(teamMemberTable.teamId, groupIds),
        ),
      )
      .limit(1);
    return members.length > 0;
  } catch {
    return false;
  }
  return false;
}

export async function assertTaskAccess(
  task: TaskAccessFields,
  userId?: string,
): Promise<void> {
  if (!userId) return;
  const allowed = await canUserAccessTask(task, userId);
  if (!allowed) {
    throw new HTTPException(403, {
      message: "You do not have permission to view or access this task",
    });
  }
}

export function taskAccessCondition(userId: string): SQL {
  return sql`(
    EXISTS (
      SELECT 1 FROM public."user" _u
      LEFT JOIN public.workspace_member _wm ON _wm.user_id = _u.id AND _wm.workspace_id = 'irdop'
      WHERE _u.id = ${userId} AND (_u.role = 'admin' OR _wm.role = 'owner' OR _wm.role = 'admin')
    )
    OR task.share_type IN ('all', 'public')
    OR task.share_type IS NULL
    OR task.creator_id = ${userId}
    OR task.created_by = ${userId}
    OR task.assignee_id = ${userId}
    OR ${userId} = ANY(COALESCE(task.assignee_ids, '{}'))
    OR ${userId} = ANY(COALESCE(task.shared_user_ids, '{}'))
    OR (
      (
        EXISTS (
          SELECT 1 FROM public.team_member _tm
          WHERE _tm.user_id = ${userId}
            AND (_tm.team_id = task.shared_group_id OR _tm.team_id = ANY(task.shared_group_ids))
        )
      )
    )
  )`;
}
