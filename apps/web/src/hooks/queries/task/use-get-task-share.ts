import { useQuery } from "@tanstack/react-query";
import { fetchTaskShare } from "@/fetchers/task/share";

export function useGetTaskShare(taskId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["task-sharing", taskId],
    queryFn: () =>
      taskId ? fetchTaskShare(taskId) : Promise.reject(new Error("No taskId")),
    enabled: Boolean(taskId && enabled),
    staleTime: 30_000,
    retry: false,
  });
}

export default useGetTaskShare;
