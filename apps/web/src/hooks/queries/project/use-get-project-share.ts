import { useQuery } from "@tanstack/react-query";
import { fetchProjectShare } from "@/fetchers/project/sharing";

export function useGetProjectShare(
  projectId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ["project-sharing", projectId],
    queryFn: () =>
      projectId
        ? fetchProjectShare(projectId)
        : Promise.reject(new Error("No projectId")),
    enabled: Boolean(projectId && enabled),
  });
}

export default useGetProjectShare;
