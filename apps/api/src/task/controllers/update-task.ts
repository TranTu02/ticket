import { and, asc, eq, getTableColumns, inArray, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  projectTable,
  taskTable,
  taskGroupTable,
  teamTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import {
  publishTaskMutation,
  recordTaskMutation,
} from "./task-mutation-effects";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";
import { boardDescription, descriptionDeferred } from "../description-pages";
import { assertValidTaskStatus } from "../validate-task-fields";
import { assertTaskPosition } from "./next-task-position";

async function updateTask(
  id: string,
  title: string,
  status: string,
  startDate: Date | undefined,
  dueDate: Date | undefined,
  projectId: string,
  description: string | undefined,
  priority: string,
  position: number,
  userId?: string,
  currentUserId?: string,
  options?: {
    shareType?: "public" | "private";
    groupId?: string | null;
    sharedGroupId?: string | null;
    sharedGroupIds?: string[];
    sharedUserIds?: string[];
    assigneeIds?: string[];
  },
) {
  assertTaskPosition(position);

  let [existingTask] = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      priority: taskTable.priority,
      userId: taskTable.userId,
      dueDate: taskTable.dueDate,
      description:
        description === undefined ? sql<null>`null` : taskTable.description,
      status: taskTable.status,
      position: taskTable.position,
      projectId: taskTable.projectId,
    })
    .from(taskTable)
    .where(eq(taskTable.id, id))
    .limit(1);

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  if (projectId !== existingTask.projectId) {
    throw new HTTPException(400, {
      message: "Use the task move endpoint to move tasks between projects",
    });
  }

  await assertValidTaskStatus(status, projectId);

  const normalizedAssigneeIds =
    options?.assigneeIds !== undefined
      ? [...new Set(options.assigneeIds.map((id) => id.trim()).filter(Boolean))]
      : userId?.trim()
        ? [userId.trim()]
        : [];
  const normalizedUserId = normalizedAssigneeIds[0];
  const assignableWorkspaceId = await getProjectWorkspaceId(projectId);
  for (const assigneeId of normalizedAssigneeIds) {
    await assertAssignableUser(assigneeId, assignableWorkspaceId, projectId);
  }

  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, projectId),
      eq(columnTable.slug, status),
    ),
  });

  const initialPosition = existingTask.position;
  const initialStatus = existingTask.status;
  const updatedTask = await db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(eq(projectTable.id, projectId))
      .for("update");
    if (!project)
      throw new HTTPException(404, { message: "Project not found" });
    const [locked] = await tx
      .select({
        id: taskTable.id,
        title: taskTable.title,
        priority: taskTable.priority,
        userId: taskTable.userId,
        dueDate: taskTable.dueDate,
        description:
          description === undefined ? sql<null>`null` : taskTable.description,
        status: taskTable.status,
        columnId: taskTable.columnId,
        position: taskTable.position,
        projectId: taskTable.projectId,
      })
      .from(taskTable)
      .where(and(eq(taskTable.id, id), eq(taskTable.projectId, projectId)))
      .for("update");
    if (!locked)
      throw new HTTPException(409, {
        message: "Task changed projects; retry the update",
      });
    if (locked.position !== initialPosition || locked.status !== initialStatus)
      throw new HTTPException(409, {
        message: "Task order changed; refresh before updating",
      });
    existingTask = locked;

    const shareFields: Record<string, unknown> = {};
    if (options?.shareType !== undefined) {
      shareFields.shareType = options.shareType;
    }
    if (
      options?.sharedGroupId !== undefined ||
      options?.groupId !== undefined
    ) {
      const gid = options?.sharedGroupId ?? options?.groupId ?? null;
      shareFields.sharedGroupId = gid;
    }
    if (options?.sharedGroupIds !== undefined) {
      shareFields.sharedGroupIds = options.sharedGroupIds;
    }
    if (options?.sharedUserIds !== undefined) {
      shareFields.sharedUserIds = options.sharedUserIds;
    }

    const [task] = await tx
      .update(taskTable)
      .set({
        title,
        status,
        columnId: column?.id ?? null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        projectId,
        description,
        priority,
        position,
        userId: normalizedUserId ?? null,
        assigneeIds: normalizedAssigneeIds,
        ...shareFields,
      })
      .where(and(eq(taskTable.id, id), eq(taskTable.projectId, projectId)))
      .returning({
        ...getTableColumns(taskTable),
        description: boardDescription,
        descriptionDeferred,
      });

    if (task && options?.sharedGroupIds !== undefined) {
      try {
        await tx.delete(taskGroupTable).where(eq(taskGroupTable.taskId, id));
        if (options.sharedGroupIds.length > 0) {
          await tx
            .insert(taskGroupTable)
            .values(
              options.sharedGroupIds.map((gid) => ({
                id: `tg_${id}_${gid}`,
                taskId: id,
                groupId: gid,
              })),
            )
            .onConflictDoNothing();
        }
      } catch {
        // ignore
      }
    }
    if (task)
      await recordTaskMutation(
        tx,
        existingTask,
        { title, dueDate: dueDate ?? null },
        currentUserId,
      );
    return task;
  });

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task",
    });
  }

  await publishTaskMutation(
    {
      ...existingTask,
      description:
        description === undefined ? undefined : existingTask.description,
    },
    { ...updatedTask, description: description ?? updatedTask.description },
    currentUserId,
  );

  await publishEvent("task.updated", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    title: updatedTask.title,
    status: updatedTask.status,
    userId: currentUserId,
  });

  return updatedTask;
}

export async function getTaskShare(taskId: string) {
  // One query for the task plus its creator: `creator_id` is the explicit
  // owner, `created_by` is the legacy audit column, so either may hold the id.
  const [task] = await db
    .select({
      taskId: taskTable.id,
      creatorId: taskTable.creatorId,
      createdBy: taskTable.createdBy,
      shareType: taskTable.shareType,
      sharedGroupId: taskTable.sharedGroupId,
      sharedGroupIds: taskTable.sharedGroupIds,
      sharedUserIds: taskTable.sharedUserIds,
      assigneeIds: taskTable.assigneeIds,
      creatorUserId: userTable.id,
      creatorUserName: userTable.name,
      creatorUserEmail: userTable.email,
    })
    .from(taskTable)
    .leftJoin(
      userTable,
      sql`${userTable.id} = coalesce(${taskTable.creatorId}, ${taskTable.createdBy})`,
    )
    .where(eq(taskTable.id, taskId));

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const cid = task.creatorId || task.createdBy || null;
  const effectiveGroupId =
    task.sharedGroupId || task.sharedGroupIds?.[0] || null;
  const effectiveGroupIds =
    task.sharedGroupIds && task.sharedGroupIds.length > 0
      ? task.sharedGroupIds
      : effectiveGroupId
        ? [effectiveGroupId]
        : [];
  const effectiveUserIds = task.sharedUserIds || [];

  const [groupRows, sharedUsers] = await Promise.all([
    effectiveGroupIds.length > 0
      ? db
          .select({
            id: teamTable.id,
            name: teamTable.name,
            memberCount: teamTable.memberCount,
          })
          .from(teamTable)
          .where(inArray(teamTable.id, effectiveGroupIds))
      : Promise.resolve([]),
    effectiveUserIds.length > 0
      ? db
          .select({
            id: userTable.id,
            userId: userTable.id,
            name: userTable.name,
            email: userTable.email,
          })
          .from(userTable)
          .where(
            or(
              inArray(userTable.id, effectiveUserIds),
              inArray(userTable.email, effectiveUserIds),
            ),
          )
          .orderBy(asc(userTable.name))
      : Promise.resolve([]),
  ]);

  const group =
    groupRows.find((candidate) => candidate.id === effectiveGroupId) ?? null;

  const creator =
    task.creatorUserId && task.creatorUserEmail
      ? {
          id: task.creatorUserId,
          name: task.creatorUserName ?? null,
          email: task.creatorUserEmail,
        }
      : null;

  return {
    taskId: task.taskId,
    creatorId: cid,
    creatorName: creator?.name ?? null,
    shareType: (task.shareType === "public" || task.shareType === "all"
      ? "public"
      : "private") as "public" | "private",
    groupId: effectiveGroupId,
    sharedGroupId: effectiveGroupId,
    sharedGroupIds: effectiveGroupIds,
    sharedUserIds: effectiveUserIds,
    assigneeIds: task.assigneeIds ?? [],
    creator,
    group,
    users: sharedUsers,
  };
}

export async function updateTaskShare(
  taskId: string,
  options: {
    shareType?: "public" | "private" | "all" | "group" | "user";
    groupId?: string | null;
    sharedGroupId?: string | null;
    sharedGroupIds?: string[];
    sharedUserIds?: string[];
  },
) {
  const [existing] = await db
    .select({ id: taskTable.id, projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, taskId));

  if (!existing) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  const gid = options.sharedGroupId ?? options.groupId ?? null;
  const groupIds = options.sharedGroupIds ?? (gid ? [gid] : []);

  await db
    .update(taskTable)
    .set({
      shareType:
        options.shareType === "all"
          ? "public"
          : options.shareType === "group" || options.shareType === "user"
            ? "private"
            : options.shareType || "public",
      sharedGroupId: gid,
      sharedGroupIds: groupIds,
      sharedUserIds: options.sharedUserIds || [],
    })
    .where(eq(taskTable.id, taskId));

  try {
    await db.delete(taskGroupTable).where(eq(taskGroupTable.taskId, taskId));
    if (groupIds.length > 0) {
      await db
        .insert(taskGroupTable)
        .values(
          groupIds.map((g) => ({
            id: `tg_${taskId}_${g}`,
            taskId,
            groupId: g,
          })),
        )
        .onConflictDoNothing();
    }
  } catch {
    // ignore
  }

  return getTaskShare(taskId);
}

export default updateTask;
