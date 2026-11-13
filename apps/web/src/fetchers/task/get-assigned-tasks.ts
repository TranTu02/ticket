import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type AssignedTasks = InferResponseType<
  (typeof client)["task"]["assigned"]["$get"],
  200
>;

export type AssignedTask = AssignedTasks["tasks"][number];

export type RelatedTaskFilters = {
  status?: "to-do" | "in-progress" | "in-review" | "done";
  priority?: "no-priority" | "low" | "medium" | "high" | "urgent";
  labelId?: string;
};

async function getAssignedTasks(
  workspaceId: string,
  countOnly = false,
  filters: RelatedTaskFilters = {},
) {
  const response = await client.task.assigned.$get({
    query: { workspaceId, countOnly: countOnly ? "true" : "false", ...filters },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getAssignedTasks;
