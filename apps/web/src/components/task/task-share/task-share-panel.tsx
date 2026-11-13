import { CheckCircle2, Globe, Info, Share2, Users } from "lucide-react";
import * as React from "react";
import { SharePicker } from "@/components/share/share-picker";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useUpdateTaskShare } from "@/hooks/mutations/task/use-update-task-share";
import { useGetTaskShare } from "@/hooks/queries/task/use-get-task-share";
import useGetSharingGroups from "@/hooks/queries/project/use-get-sharing-groups";
import useGetSharingUsers from "@/hooks/queries/project/use-get-sharing-users";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type { TaskShareConfig, TaskShareVisibility } from "@/types/task-share";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";

interface TaskSharePanelProps {
  taskId: string;
  taskTitle?: string;
  initialShareConfig?: TaskShareConfig;
  onSaved?: () => void;
  className?: string;
  hideHeader?: boolean;
}

const SHARE_MODES: {
  value: TaskShareVisibility;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "public",
    label: "Public",
    description:
      "Workspace members can view this ticket. Selected users and groups are additional shares.",
    icon: Globe,
  },
  {
    value: "private",
    label: "Private",
    description:
      "Only the creator, assignees and selected users or groups can view this ticket.",
    icon: Users,
  },
];

export function TaskSharePanel({
  taskId,
  taskTitle,
  initialShareConfig,
  onSaved,
  className,
  hideHeader = false,
}: TaskSharePanelProps) {
  const { canUpdateTasks, isCheckingPermissions } = useWorkspacePermission();
  const { user: currentUser } = useAuth();

  const { data: shareData, isLoading: isLoadingShare } = useGetTaskShare(
    taskId,
    true,
  );
  const canEdit =
    canUpdateTasks() ||
    Boolean(
      currentUser?.id &&
      shareData &&
      (shareData.creatorId === currentUser.id ||
        shareData.assigneeIds?.includes(currentUser.id)),
    );
  const { data: groups = [], isLoading: isLoadingGroups } =
    useGetSharingGroups();
  const { data: users = [], isLoading: isLoadingUsers } = useGetSharingUsers();
  const { mutateAsync: updateShare, isPending: isSaving } =
    useUpdateTaskShare(taskId);

  const [shareType, setShareType] = React.useState<TaskShareVisibility>(
    initialShareConfig?.shareType ?? "public",
  );
  const [creatorId, setCreatorId] = React.useState<string | null>(
    initialShareConfig?.creatorId ?? initialShareConfig?.creator?.id ?? null,
  );
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>(
    initialShareConfig?.sharedGroupIds ??
      (initialShareConfig?.sharedGroupId
        ? [initialShareConfig.sharedGroupId]
        : initialShareConfig?.groupId
          ? [initialShareConfig.groupId]
          : []),
  );
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>(
    initialShareConfig?.sharedUserIds ?? [],
  );
  const [hasInitialized, setHasInitialized] = React.useState(
    Boolean(initialShareConfig),
  );

  React.useEffect(() => {
    if (shareData && !hasInitialized) {
      setShareType(shareData.shareType || "public");
      setCreatorId(shareData.creatorId ?? shareData.creator?.id ?? null);
      setSelectedGroupIds(
        shareData.sharedGroupIds ??
          (shareData.sharedGroupId
            ? [shareData.sharedGroupId]
            : shareData.groupId
              ? [shareData.groupId]
              : []),
      );
      setSelectedUserIds(shareData.sharedUserIds ?? []);
      setHasInitialized(true);
    }
  }, [shareData, hasInitialized]);

  const activeGroupIds = React.useMemo(
    () => selectedGroupIds.filter(Boolean),
    [selectedGroupIds],
  );
  const selectedGroups = groups.filter((group) =>
    activeGroupIds.includes(group.id),
  );
  const selectedUsers = users.filter((user) =>
    selectedUserIds.includes(user.id),
  );
  const selectedGroupId = activeGroupIds[0] ?? null;

  const handleSave = async () => {
    if (!canEdit) {
      toast.error("Bạn không có quyền cập nhật quyền truy cập ticket.");
      return;
    }

    try {
      await updateShare({
        shareType,
        groupId: selectedGroupId,
        sharedGroupId: selectedGroupId,
        sharedGroupIds: activeGroupIds,
        sharedUserIds: selectedUserIds,
      });

      toast.success("Đã cập nhật quyền truy cập ticket thành công!", {
        icon: Share2,
      });
      onSaved?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Cập nhật chia sẻ ticket thất bại.",
      );
    }
  };

  const isLoading =
    (isLoadingShare && !hasInitialized) || isCheckingPermissions;

  if (isLoading) {
    return (
      <div className={cn("flex h-40 items-center justify-center", className)}>
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      {!hideHeader && (
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Share2 className="size-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              Quyền truy cập &amp; Chia sẻ ticket
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {taskTitle
                ? `Thiết lập những ai có thể xem ticket "${taskTitle}".`
                : "Thiết lập những ai có thể xem ticket này."}{" "}
              Người tạo ticket luôn giữ quyền truy cập.
            </p>
          </div>
        </div>
      )}

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            Bạn chỉ có quyền xem cấu hình chia sẻ của ticket này. Liên hệ quản
            trị viên workspace nếu cần thay đổi.
          </span>
        </div>
      )}

      <section className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
        <div>
          <h4 className="text-sm font-semibold">Current access</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {shareType === "public"
              ? "All workspace members can view this ticket. Selected people and groups are also listed below."
              : "Only selected people and groups, the creator, and assignees can view this ticket."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Shared with groups
            </p>
            {selectedGroups.length ? (
              selectedGroups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-background px-2.5 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Users className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{group.name}</span>
                  </span>
                  {group.memberCount !== undefined && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {group.memberCount} members
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="rounded-md bg-background px-2.5 py-2 text-xs text-muted-foreground">
                No groups selected
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Shared with people
            </p>
            {selectedUsers.length ? (
              selectedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex min-w-0 items-center gap-2 rounded-md bg-background px-2.5 py-2 text-sm"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{user.name || user.email}</span>
                    {user.name && (
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    )}
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-md bg-background px-2.5 py-2 text-xs text-muted-foreground">
                No people selected
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Share mode selection */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {SHARE_MODES.map((mode) => {
          const ModeIcon = mode.icon;
          const isActive = shareType === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              disabled={!canEdit}
              onClick={() => setShareType(mode.value)}
              className={cn(
                "flex flex-col items-start rounded-lg border p-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60",
                isActive
                  ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                  : "border-border hover:border-foreground/30 hover:bg-muted/40",
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <ModeIcon className="size-4" />
                </div>
                <span className="text-sm font-semibold">{mode.label}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {mode.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Creator / groups / users picker */}
      <SharePicker
        mode={shareType}
        showAllTargets
        creatorEditable={false}
        users={users}
        groups={groups}
        loadingUsers={isLoadingUsers}
        loadingGroups={isLoadingGroups}
        creatorId={creatorId}
        onCreatorIdChange={() => {}}
        selectedUserIds={selectedUserIds}
        onSelectedUserIdsChange={setSelectedUserIds}
        selectedGroupIds={selectedGroupIds}
        onSelectedGroupIdsChange={setSelectedGroupIds}
        disabled={!canEdit}
      />

      {shareType === "public" && (
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>Chế độ mặc định Workspace</span>
          </div>
          <p className="mt-1">
            Ticket này mở cho toàn bộ
            {users.length > 0 ? ` ${users.length}` : ""} thành viên hoạt động
            của Workspace.
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          onClick={handleSave}
          disabled={!canEdit || isSaving}
          className="gap-2"
        >
          {isSaving && <Spinner className="size-3.5" />}
          <span>Lưu quyền truy cập</span>
        </Button>
      </div>
    </div>
  );
}

export default TaskSharePanel;
