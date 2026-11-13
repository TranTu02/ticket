import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { withLockedTask } from "./with-locked-task";
import { taskTable } from "../../database/schema";
import { publishTaskMutation } from "./task-mutation-effects";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";

async function updateTaskAssignee({
  id,
  userId,
  assigneeIds,
  currentUserId,
}: {
  id: string;
  userId: string | null;
  assigneeIds?: string[];
  currentUserId: string;
}) {
  const { before: existingTask, after: updatedTask } = await withLockedTask(
    id,
    async (tx, existingTask) => {
      const nextAssigneeIds = [
        ...new Set(
          (assigneeIds ?? (userId ? [userId] : []))
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ];
      const nextAssigneeId = nextAssigneeIds[0] ?? null;
      if (
        existingTask.userId === nextAssigneeId &&
        (existingTask.assigneeIds ?? []).join("\0") ===
          nextAssigneeIds.join("\0")
      ) {
        return existingTask;
      }

      for (const nextId of nextAssigneeIds) {
        await assertAssignableUser(
          nextId,
          await getProjectWorkspaceId(existingTask.projectId, tx),
          existingTask.projectId,
          tx,
        );
      }

      const [updatedTask] = await tx
        .update(taskTable)
        .set({ userId: nextAssigneeId, assigneeIds: nextAssigneeIds })
        .where(eq(taskTable.id, id))
        .returning();

      if (!updatedTask) {
        throw new HTTPException(500, {
          message: "Failed to update task assignee",
        });
      }

      return updatedTask;
    },
  );

  await publishTaskMutation(existingTask, updatedTask, currentUserId, {
    fields: ["userId"],
  });

  return updatedTask;
}

export default updateTaskAssignee;
