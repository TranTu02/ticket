import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";
import { loadBoardPages } from "./load-board-pages";
import { i18n } from "@/lib/i18n";

async function getTasks(
  projectId: string,
  signal?: AbortSignal,
  onProgress?: (
    board: InferResponseType<
      (typeof client)["task"]["tasks"][":projectId"]["$get"],
      200
    >["data"],
  ) => void,
) {
  return loadBoardPages(
    async (page, relatedPage) => {
      const response = await client.task.tasks[":projectId"].$get(
        {
          param: { projectId },
          query: {
            page: String(page),
            limit: "100",
            ...(relatedPage ? { relatedPage: String(relatedPage) } : {}),
          },
        },
        { init: { signal } },
      );
      if (!response.ok)
        throw new HttpError(response.status, i18n.t("tasks:board.loadFailed"));
      return response.json();
    },
    signal,
    onProgress,
  );
}
export default getTasks;
