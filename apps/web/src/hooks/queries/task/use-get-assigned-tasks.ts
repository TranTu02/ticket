import { useQuery } from "@tanstack/react-query";
import getAssignedTasks from "@/fetchers/task/get-assigned-tasks";
import type { RelatedTaskFilters } from "@/fetchers/task/get-assigned-tasks";

function useGetAssignedTasks(
  workspaceId: string | undefined,
  countOnly = false,
  filters: RelatedTaskFilters = {},
) {
  return useQuery({
    queryKey: ["assigned-tasks", workspaceId, { countOnly, ...filters }],
    queryFn: () => getAssignedTasks(workspaceId ?? "", countOnly, filters),
    enabled: Boolean(workspaceId),
    // The app default skips refetching on mount; these lists go stale while
    // the user works elsewhere.
    refetchOnMount: "always",
    // Workspace pages have no project socket; refresh remote edits and activity
    // even when they do not produce a notification. Poll only while visible.
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
}

export default useGetAssignedTasks;
