import { boundedTaskRead } from "../bounded-read";
import { alias } from "drizzle-orm/pg-core";
import { boardDescription, descriptionDeferred } from "../description-pages";
import { isSubtask } from "../is-subtask";
import { getSubtaskCounts } from "../get-subtask-counts";
import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  taskTable,
  userTable,
  projectTable,
  taskRelationTable,
} from "../../database/schema";

import { assertTaskAccess } from "../task-access-condition";

async function getTask(taskId: string, board = false, userId?: string) {
  const task = await db
    .select({
      id: taskTable.id,
      isSubtask,
      title: taskTable.title,
      number: taskTable.number,
      description: board ? boardDescription : taskTable.description,
      ...(board
        ? {
            descriptionDeferred,
          }
        : {}),
      status: taskTable.status,
      columnId: taskTable.columnId,
      priority: taskTable.priority,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      recurrence: taskTable.recurrence,
      creatorId: taskTable.creatorId,
      createdBy: taskTable.createdBy,
      creatorName: sql<string | null>`(SELECT name FROM public."user" WHERE id = ${taskTable.creatorId} OR id = ${taskTable.createdBy} LIMIT 1)`,
      shareType: taskTable.shareType,
      groupId: taskTable.sharedGroupId,
      sharedGroupId: taskTable.sharedGroupId,
      sharedGroupIds: taskTable.sharedGroupIds,
      sharedUserIds: taskTable.sharedUserIds,
      position: taskTable.position,
      createdAt: taskTable.createdAt,
      userId: taskTable.userId,
      assigneeIds: taskTable.assigneeIds,
      assigneeName: userTable.name,
      assigneeId: userTable.id,
      projectId: taskTable.projectId,
      workspaceId: sql<string>`(select ${projectTable.workspaceId} from ${projectTable} where ${projectTable.id} = ${taskTable.projectId})`,
    })
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task.length || !task[0]) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  if (userId) {
    await assertTaskAccess(task[0], userId);
  }

  if (!board) return task[0];
  const { workspaceId, ...result } = task[0];
  if (!workspaceId) return result;
  const parent = alias(taskTable, "parent");
  const parents = await db
    .selectDistinct({ id: parent.id })
    .from(taskRelationTable)
    .innerJoin(parent, eq(taskRelationTable.sourceTaskId, parent.id))
    .where(
      and(
        eq(taskRelationTable.targetTaskId, taskId),
        eq(taskRelationTable.relationType, "subtask"),
        eq(parent.projectId, result.projectId),
      ),
    );
  const counts = await boundedTaskRead((tx) =>
    getSubtaskCounts(
      tx,
      [taskId, ...parents.map((task) => task.id)],
      workspaceId,
      false,
      userId,
    ),
  );
  return {
    ...result,
    subtaskCounts: counts.get(taskId) ?? { completed: 0, total: 0 },
    parentSubtaskCounts: parents.map(({ id }) => ({
      taskId: id,
      ...(counts.get(id) ?? { completed: 0, total: 0 }),
    })),
  };
}

export default getTask;
