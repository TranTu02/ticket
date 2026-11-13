import { Check, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskAssignee } from "@/hooks/mutations/task/use-update-task-assignee";
import useGetProjectMembers from "@/hooks/queries/workspace-users/use-get-project-members";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskAssigneePopoverProps = {
  task: Task;
  workspaceId: string;
  children: React.ReactNode;
};

export default function TaskAssigneePopover({
  task,
  workspaceId,
  children,
}: TaskAssigneePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(
    task.assigneeIds ?? (task.userId ? [task.userId] : []),
  );
  const { mutateAsync: updateTaskAssignee } = useUpdateTaskAssignee();
  const { data: members = [] } = useGetProjectMembers({
    workspaceId,
    projectId: task.projectId,
  });
  const { canAssignTasks } = useWorkspacePermission();

  useEffect(() => {
    if (open)
      setSelectedIds(task.assigneeIds ?? (task.userId ? [task.userId] : []));
  }, [open, task.assigneeIds, task.userId]);

  if (!canAssignTasks()) return <>{children}</>;

  const saveAssignees = async () => {
    setOpen(false);
    try {
      await updateTaskAssignee({
        ...task,
        assigneeIds: selectedIds,
        userId: selectedIds[0] ?? null,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.assignee.updateError"),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("tasks:bulk.assigneePlaceholder")}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-accent"
          >
            <Users className="size-4 text-muted-foreground" />
            {t("tasks:popover.assignee.unassigned")}
            {selectedIds.length === 0 && <Check className="ml-auto size-4" />}
          </button>
          {members
            .filter((member) =>
              member.name.toLowerCase().includes(search.trim().toLowerCase()),
            )
            .map((member) => {
              const checked = selectedIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() =>
                    setSelectedIds((ids) =>
                      checked
                        ? ids.filter((id) => id !== member.id)
                        : [...ids, member.id],
                    )
                  }
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="min-w-0 flex-1 truncate">{member.name}</span>
                  {checked && <Check className="size-4" />}
                </button>
              );
            })}
        </div>
        <div className="flex items-center justify-between border-t p-2">
          <span className="text-xs text-muted-foreground">
            {selectedIds.length} được assign
          </span>
          <button
            type="button"
            onClick={() => void saveAssignees()}
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Lưu
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
