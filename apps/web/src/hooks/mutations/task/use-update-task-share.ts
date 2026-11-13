import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTaskShare } from "@/fetchers/task/share";
import type { UpdateTaskShareRequest } from "@/types/task-share";

export function useUpdateTaskShare(taskId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (payload: UpdateTaskShareRequest) =>
			updateTaskShare(taskId, payload),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["task-sharing", taskId],
			});
			void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
			void queryClient.invalidateQueries({ queryKey: ["tasks"] });
		},
	});
}

export default useUpdateTaskShare;
