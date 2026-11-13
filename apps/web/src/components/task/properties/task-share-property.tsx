import {
  Check,
  Globe,
  LockKeyhole,
  RefreshCw,
  Search,
  Share2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TaskShareModal } from "@/components/task/task-share/task-share-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useUpdateTaskShare } from "@/hooks/mutations/task/use-update-task-share";
import useGetSharingGroups from "@/hooks/queries/project/use-get-sharing-groups";
import useGetSharingUsers from "@/hooks/queries/project/use-get-sharing-users";
import { useGetTaskShare } from "@/hooks/queries/task/use-get-task-share";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import type { TaskShareVisibility } from "@/types/task-share";
import { PropertyRow } from "./property-row";
import { PropertyValue } from "./property-value";

type EditTarget = "users" | "groups";

type RecipientItem = {
  id: string;
  name: string;
  detail?: string;
};

export function TaskShareProperty({
  taskId,
  taskTitle,
}: {
  taskId: string;
  taskTitle: string;
}) {
  const { t } = useTranslation();
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [isVisibilityOpen, setIsVisibilityOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draftUserIds, setDraftUserIds] = useState<string[]>([]);
  const [draftGroupIds, setDraftGroupIds] = useState<string[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const { user: currentUser } = useAuth();
  const { canUpdateTasks } = useWorkspacePermission();
  const {
    data: share,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useGetTaskShare(taskId);
  const { data: groups = [] } = useGetSharingGroups();
  const { data: users = [] } = useGetSharingUsers();
  const { mutateAsync: updateShare, isPending: isSaving } =
    useUpdateTaskShare(taskId);

  const canEdit =
    canUpdateTasks() ||
    Boolean(
      currentUser?.id &&
      share &&
      (share.creatorId === currentUser.id ||
        share.assigneeIds?.includes(currentUser.id)),
    );
  const selectedGroupIds = share?.sharedGroupIds?.length
    ? share.sharedGroupIds
    : share?.sharedGroupId
      ? [share.sharedGroupId]
      : share?.groupId
        ? [share.groupId]
        : [];
  const selectedUserIds = share?.sharedUserIds ?? [];
  const selectedGroups: RecipientItem[] = selectedGroupIds.map((id) => {
    const group = groups.find((candidate) => candidate.id === id);
    return {
      id,
      name: group?.name ?? id,
      detail: group?.memberCount
        ? t("tasks:share.membersCount", { count: group.memberCount })
        : undefined,
    };
  });
  const selectedUsers: RecipientItem[] = selectedUserIds.map((id) => {
    const user = users.find((candidate) => candidate.id === id);
    return {
      id,
      name: user?.name || user?.email || id,
      detail: user?.name ? user.email : undefined,
    };
  });
  const recipientItems: Record<EditTarget, RecipientItem[]> = {
    users: users.map((user) => ({
      id: user.id,
      name: user.name || user.email,
      detail: user.name ? user.email : undefined,
    })),
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      detail: group.memberCount
        ? t("tasks:share.membersCount", { count: group.memberCount })
        : undefined,
    })),
  };
  const activeDraftIds = editTarget === "users" ? draftUserIds : draftGroupIds;
  const filteredItems = editTarget
    ? recipientItems[editTarget].filter((item) =>
        `${item.name} ${item.detail ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )
    : [];

  const openEditor = (target: EditTarget) => {
    setSearch("");
    setEditTarget(target);
    setDraftUserIds(selectedUserIds);
    setDraftGroupIds(selectedGroupIds);
  };

  const saveRecipients = async () => {
    if (!canEdit || !share) return;
    const nextUserIds = editTarget === "users" ? draftUserIds : selectedUserIds;
    const nextGroupIds =
      editTarget === "groups" ? draftGroupIds : selectedGroupIds;
    const firstGroupId = nextGroupIds[0] ?? null;

    try {
      await updateShare({
        shareType: share.shareType as TaskShareVisibility,
        groupId: firstGroupId,
        sharedGroupId: firstGroupId,
        sharedGroupIds: nextGroupIds,
        sharedUserIds: nextUserIds,
      });
      setEditTarget(null);
      toast.success(t("tasks:share.recipientsUpdated"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:share.updateError"),
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-8 flex-1 items-center px-2">
        <Spinner className="size-4 text-muted-foreground" />
      </div>
    );
  }

  if (isError || !share) {
    return (
      <div className="min-w-0 flex-1 px-2 py-1">
        <p className="break-words text-[11px] text-destructive">
          {error instanceof Error ? error.message : t("tasks:share.loadError")}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="mt-1 h-6 justify-start px-1.5 text-xs"
          disabled={isRetrying || isFetching}
          onClick={async () => {
            setIsRetrying(true);
            const result = await refetch();
            setIsRetrying(false);
            if (result.error) {
              toast.error(
                result.error instanceof Error
                  ? result.error.message
                  : t("tasks:share.loadError"),
              );
            }
          }}
        >
          {isRetrying || isFetching ? (
            <Spinner className="size-3.5" />
          ) : (
            <RefreshCw />
          )}
          {t("tasks:share.retry")}
        </Button>
      </div>
    );
  }

  const renderRecipientRow = (target: EditTarget, items: RecipientItem[]) => (
    <Popover
      open={editTarget === target}
      onOpenChange={(open) => {
        if (open) openEditor(target);
        else {
          setEditTarget(null);
          setSearch("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <PropertyValue
          disabled={!canEdit}
          className="h-auto min-h-7.5 items-start py-1.25"
        >
          {items.length ? (
            <span className="flex min-w-0 flex-1 flex-wrap gap-1">
              {items.map((item) => (
                <span
                  key={item.id}
                  className="max-w-full break-words rounded bg-muted px-1.5 py-0.5 text-xs"
                >
                  {item.name}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {target === "users"
                ? t("tasks:share.addPeople")
                : t("tasks:share.addGroups")}
            </span>
          )}
        </PropertyValue>
      </PopoverTrigger>
      <PopoverContent align="start" side="left" className="w-72 p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              target === "users"
                ? t("tasks:share.searchPeople")
                : t("tasks:share.searchGroups")
            }
            className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {filteredItems.length ? (
            filteredItems.map((item) => {
              const checked = activeDraftIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const update = (ids: string[]) =>
                      checked
                        ? ids.filter((id) => id !== item.id)
                        : [...ids, item.id];
                    if (target === "users") setDraftUserIds(update);
                    else setDraftGroupIds(update);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
                >
                  {target === "groups" && (
                    <Users className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.name}</span>
                    {item.detail && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    )}
                  </span>
                  {checked && <Check className="size-4 text-primary" />}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {target === "users"
                ? t("tasks:share.noPeopleFound")
                : t("tasks:share.noGroupsFound")}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between border-t p-2">
          <span className="text-xs text-muted-foreground">
            {t("tasks:share.selectedCount", { count: activeDraftIds.length })}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={() => void saveRecipients()}
          >
            {t("tasks:share.save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  const VisibilityIcon = share.shareType === "public" ? Globe : LockKeyhole;

  return (
    <>
      <div className="min-w-0 flex-1">
        <PropertyRow label={t("tasks:share.visibility")}>
          <PropertyValue
            disabled={!canEdit}
            onClick={() => setIsVisibilityOpen(true)}
          >
            <VisibilityIcon className="text-muted-foreground" />
            <span>{share.shareType === "public" ? "Public" : "Private"}</span>
            <Share2 className="ml-auto text-muted-foreground" />
          </PropertyValue>
        </PropertyRow>
        <PropertyRow label={t("tasks:share.users")} align="start">
          {renderRecipientRow("users", selectedUsers)}
        </PropertyRow>
        <PropertyRow label={t("tasks:share.groups")} align="start">
          {renderRecipientRow("groups", selectedGroups)}
        </PropertyRow>
        <p className="px-2 py-1 text-[10px] text-muted-foreground">
          {t("tasks:share.creatorRetainsAccess")}
        </p>
      </div>
      <TaskShareModal
        open={isVisibilityOpen}
        onClose={() => setIsVisibilityOpen(false)}
        taskId={taskId}
        taskTitle={taskTitle}
      />
    </>
  );
}
