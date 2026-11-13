import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProjectShare } from "@/fetchers/project/sharing";
import type { UpdateProjectShareRequest } from "@/types/project-share";

export function useUpdateProjectShare(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateProjectShareRequest) =>
      updateProjectShare(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["project-sharing", projectId],
      });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export default useUpdateProjectShare;
