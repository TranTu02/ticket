import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getPublicTaskDescription } from "@/fetchers/task/get-description-pages";
import type Task from "@/types/task";

export function usePublicTaskDescription(task: Task | null, open: boolean) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ["public-task-description", task?.projectId, task?.id],
    queryFn: ({ signal }) => {
      if (!task) throw new Error(t("tasks:detail.noTaskSelected"));
      return getPublicTaskDescription(task.projectId, task.id, signal);
    },
    enabled: open && !!task?.descriptionDeferred,
    refetchOnMount: "always",
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}
