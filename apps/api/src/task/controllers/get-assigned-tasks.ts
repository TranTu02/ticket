import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  exists,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  activityTable,
  commentTable,
  labelTable,
  projectTable,
  taskTable,
  teamMemberTable,
} from "../../database/schema";

// Home and My tasks render this list whole, so it stays one bounded page.
export const ASSIGNED_TASKS_LIMIT = 100;

async function getAssignedTasks(
  workspaceId: string,
  userId: string,
  countOnly = false,
  filters: { status?: string; priority?: string; labelId?: string } = {},
) {
  const relatedToMe = or(
    eq(taskTable.creatorId, userId),
    eq(taskTable.createdBy, userId),
    eq(taskTable.userId, userId),
    sql`${userId} = ANY(COALESCE(${taskTable.assigneeIds}, '{}'))`,
    sql`${userId} = ANY(COALESCE(${taskTable.sharedUserIds}, '{}'))`,
    exists(
      db
        .select({ one: sql`1` })
        .from(teamMemberTable)
        .where(
          and(
            eq(teamMemberTable.userId, userId),
            sql`(${teamMemberTable.teamId} = ${taskTable.sharedGroupId} OR ${teamMemberTable.teamId} = ANY(COALESCE(${taskTable.sharedGroupIds}, '{}')))`,
          ),
        ),
    ),
  );
  const queryConditions = [
    eq(projectTable.workspaceId, workspaceId),
    isNull(projectTable.archivedAt),
    ne(taskTable.status, "archived"),
    relatedToMe,
  ];
  if (filters.status)
    queryConditions.push(eq(taskTable.status, filters.status));
  if (filters.priority)
    queryConditions.push(eq(taskTable.priority, filters.priority));
  if (filters.labelId)
    queryConditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(labelTable)
          .where(
            and(
              eq(labelTable.taskId, taskTable.id),
              eq(labelTable.id, filters.labelId),
            ),
          ),
      ),
    );
  const openAndMine = and(...queryConditions);

  const totalsQuery = db
    .select({ total: count() })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(openAndMine);

  if (countOnly) {
    const [totals] = await totalsQuery;
    return { tasks: [], total: Number(totals?.total ?? 0) };
  }

  // Existing databases may contain duplicate slugs from concurrent column
  // creation. A lateral lookup must return at most one decoration per task.
  const statusColumn = db
    .select({ name: columnTable.name, icon: columnTable.icon })
    .from(columnTable)
    .where(
      and(
        eq(columnTable.projectId, taskTable.projectId),
        eq(columnTable.slug, taskTable.status),
      ),
    )
    .orderBy(
      sql`case when ${columnTable.id} = ${taskTable.columnId} then 0 else 1 end`,
      asc(columnTable.position),
      asc(columnTable.createdAt),
      asc(columnTable.id),
    )
    .limit(1)
    .as("assigned_status_column");

  const lastModified = sql<Date>`greatest(
    ${taskTable.updatedAt},
    coalesce((select max(${activityTable.updatedAt}) from ${activityTable} where ${activityTable.taskId} = ${taskTable.id}), ${taskTable.createdAt}),
    coalesce((select max(${commentTable.updatedAt}) from ${commentTable} where ${commentTable.taskId} = ${taskTable.id}), ${taskTable.createdAt})
  )`;

  const [tasks, [totals]] = await Promise.all([
    db
      .select({
        id: taskTable.id,
        parentTaskId: sql<
          string | null
        >`(SELECT source_task_id FROM public.task_relation WHERE target_task_id = ${taskTable.id} AND relation_type = 'subtask' ORDER BY created_at LIMIT 1)`,
        projectId: taskTable.projectId,
        number: taskTable.number,
        title: taskTable.title,
        status: taskTable.status,
        statusName: statusColumn.name,
        statusIcon: statusColumn.icon,
        priority: taskTable.priority,
        creatorId: taskTable.creatorId,
        creatorName: sql<
          string | null
        >`(SELECT name FROM public."user" WHERE id = ${taskTable.creatorId} OR id = ${taskTable.createdBy} LIMIT 1)`,
        createdAt: taskTable.createdAt,
        updatedAt: lastModified,
        createdByMe: sql<boolean>`coalesce(${taskTable.creatorId} = ${userId} OR ${taskTable.createdBy} = ${userId}, false)`,
        assignedToMe: sql<boolean>`coalesce(${taskTable.userId} = ${userId} OR ${userId} = ANY(COALESCE(${taskTable.assigneeIds}, '{}')), false)`,
        sharedWithMe: sql<boolean>`(${userId} = ANY(COALESCE(${taskTable.sharedUserIds}, '{}')) OR EXISTS (SELECT 1 FROM public.team_member rel_tm WHERE rel_tm.user_id = ${userId} AND (rel_tm.team_id = ${taskTable.sharedGroupId} OR rel_tm.team_id = ANY(COALESCE(${taskTable.sharedGroupIds}, '{}')))))`,
        dueDate: taskTable.dueDate,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        projectIcon: projectTable.icon,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoinLateral(statusColumn, sql`true`)
      .where(openAndMine)
      .orderBy(desc(lastModified), asc(taskTable.id))
      .limit(ASSIGNED_TASKS_LIMIT),
    totalsQuery,
  ]);

  const labels = tasks.length
    ? await db
        .select({
          id: labelTable.id,
          name: labelTable.name,
          color: labelTable.color,
          taskId: labelTable.taskId,
        })
        .from(labelTable)
        .where(
          inArray(
            labelTable.taskId,
            tasks.map((task) => task.id),
          ),
        )
        .orderBy(asc(labelTable.name), asc(labelTable.id))
    : [];

  const labelsByTask = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >();
  for (const { taskId, ...label } of labels) {
    if (!taskId) continue;
    const taskLabels = labelsByTask.get(taskId) ?? [];
    taskLabels.push(label);
    labelsByTask.set(taskId, taskLabels);
  }

  return {
    tasks: tasks.map((task) => ({
      ...task,
      labels: labelsByTask.get(task.id) ?? [],
    })),
    total: Number(totals?.total ?? 0),
  };
}

export default getAssignedTasks;
