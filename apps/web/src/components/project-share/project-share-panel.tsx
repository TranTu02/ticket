import {
  CheckCircle2,
  FolderLock,
  Globe,
  UserCheck,
  Users,
} from "lucide-react";
import * as React from "react";
import SharePicker from "@/components/share/share-picker";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import useUpdateProjectShare from "@/hooks/mutations/project/use-update-project-share";
import useGetProjectShare from "@/hooks/queries/project/use-get-project-share";
import useGetSharingGroups from "@/hooks/queries/project/use-get-sharing-groups";
import useGetSharingUsers from "@/hooks/queries/project/use-get-sharing-users";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type { ProjectShareConfig, ShareType } from "@/types/project-share";

interface ProjectSharePanelProps {
  projectId: string;
  initialShareConfig?: ProjectShareConfig;
  onSaved?: () => void;
  className?: string;
  hideHeader?: boolean;
}

export function ProjectSharePanel({
  projectId,
  initialShareConfig,
  onSaved,
  className,
  hideHeader = false,
}: ProjectSharePanelProps) {
  const { data: shareData, isLoading: isLoadingShare } = useGetProjectShare(
    projectId,
    !initialShareConfig,
  );
  const { data: groups = [], isLoading: isLoadingGroups } =
    useGetSharingGroups();
  const { data: users = [], isLoading: isLoadingUsers } = useGetSharingUsers();
  const { mutateAsync: updateShare, isPending: isSaving } =
    useUpdateProjectShare(projectId);

  const [shareType, setShareType] = React.useState<ShareType>(
    initialShareConfig?.shareType ?? "all",
  );
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>(
    initialShareConfig?.groupId
      ? [initialShareConfig.groupId]
      : (initialShareConfig?.sharedGroupIds ?? []),
  );
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>(
    initialShareConfig?.sharedUserIds ?? [],
  );
  const [creatorId, setCreatorId] = React.useState<string | null>(
    initialShareConfig?.creatorId ?? null,
  );

  const [hasInitialized, setHasInitialized] = React.useState(
    Boolean(initialShareConfig),
  );

  React.useEffect(() => {
    if (shareData && !hasInitialized) {
      setShareType(shareData.shareType || "all");
      setSelectedGroupIds(
        shareData.groupId
          ? [shareData.groupId]
          : shareData.sharedGroupId
            ? [shareData.sharedGroupId]
            : (shareData.sharedGroupIds ?? []),
      );
      setSelectedUserIds(shareData.sharedUserIds || []);
      setCreatorId(shareData.creatorId ?? null);
      setHasInitialized(true);
    }
  }, [shareData, hasInitialized]);

  const selectedGroupId = selectedGroupIds[0] ?? null;

  const handleSave = async () => {
    if (shareType === "group" && selectedGroupIds.length === 0) {
      toast.error("Vui lòng chọn một nhóm để chia sẻ.");
      return;
    }

    if (shareType === "user" && selectedUserIds.length === 0) {
      toast.error("Vui lòng chọn ít nhất một nhân sự để chia sẻ.");
      return;
    }

    try {
      await updateShare({
        shareType,
        groupId: shareType === "group" ? selectedGroupId : null,
        sharedGroupId: shareType === "group" ? selectedGroupId : null,
        sharedGroupIds: shareType === "group" ? selectedGroupIds : [],
        sharedUserIds: shareType === "user" ? selectedUserIds : [],
        creatorId: creatorId ?? null,
      });

      toast.success("Đã cập nhật quyền truy cập dự án thành công!", {
        icon: FolderLock,
      });
      onSaved?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Cập nhật chia sẻ dự án thất bại.",
      );
    }
  };

  if (isLoadingShare && !hasInitialized) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {!hideHeader && (
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Quyền truy cập & Chia sẻ dự án
          </h3>
          <p className="text-sm text-muted-foreground">
            Chỉ định ai trong tổ chức IRDOP có thể xem và làm việc với dự án này.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        Người tạo dự án luôn có quyền truy cập và được quản lý ở khu riêng, không
        nằm trong danh sách người được chia sẻ.
      </p>

      {/* Mode selection cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Workspace-wide */}
        <button
          type="button"
          onClick={() => setShareType("all")}
          className={cn(
            "flex flex-col items-start rounded-lg border p-3.5 text-left transition-all",
            shareType === "all"
              ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
              : "border-border hover:border-foreground/30 hover:bg-muted/40",
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-md",
                shareType === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Globe className="size-4" />
            </div>
            <span className="text-sm font-semibold">Tất cả thành viên</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Mọi nhân sự trong IRDOP đều có thể truy cập dự án.
          </p>
        </button>

        {/* By Group */}
        <button
          type="button"
          onClick={() => setShareType("group")}
          className={cn(
            "flex flex-col items-start rounded-lg border p-3.5 text-left transition-all",
            shareType === "group"
              ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
              : "border-border hover:border-foreground/30 hover:bg-muted/40",
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-md",
                shareType === "group"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Users className="size-4" />
            </div>
            <span className="text-sm font-semibold">Theo Nhóm</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Chỉ nhân sự thuộc nhóm được chọn mới có quyền truy cập.
          </p>
        </button>

        {/* By User */}
        <button
          type="button"
          onClick={() => setShareType("user")}
          className={cn(
            "flex flex-col items-start rounded-lg border p-3.5 text-left transition-all",
            shareType === "user"
              ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
              : "border-border hover:border-foreground/30 hover:bg-muted/40",
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-md",
                shareType === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <UserCheck className="size-4" />
            </div>
            <span className="text-sm font-semibold">Theo Người dùng</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Chỉ những nhân sự được chọn cụ thể mới có quyền truy cập.
          </p>
        </button>
      </div>

      {/* Mode Content: Workspace All */}
      {shareType === "all" && (
        <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>Chế độ mặc định Workspace</span>
          </div>
          <p className="mt-1 text-xs">
            Dự án này mở cho toàn bộ {users.length > 0 ? `${users.length} ` : ""}
            thành viên hoạt động của Workspace IRDOP.
          </p>
        </div>
      )}

      {/* Người tạo + người được chia sẻ: ba khu riêng biệt do SharePicker dựng */}
      <SharePicker
        mode={shareType}
        users={users}
        groups={groups}
        loadingUsers={isLoadingUsers}
        loadingGroups={isLoadingGroups}
        creatorId={creatorId}
        onCreatorIdChange={setCreatorId}
        selectedUserIds={selectedUserIds}
        onSelectedUserIdsChange={setSelectedUserIds}
        selectedGroupIds={selectedGroupIds}
        onSelectedGroupIdsChange={setSelectedGroupIds}
        disabled={isSaving}
      />

      {shareType === "user" && selectedUserIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Đã chọn {selectedUserIds.length} nhân sự. Dự án chỉ hiển thị với những
          người này (và người tạo).
        </p>
      )}

      {shareType === "group" && selectedGroupId && (
        <p className="text-xs text-muted-foreground">
          Dự án chỉ hiển thị với nhân sự thuộc nhóm{" "}
          <strong className="font-semibold text-foreground">
            {groups.find((group) => group.id === selectedGroupId)?.name ??
              selectedGroupId}
          </strong>
          .
        </p>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving && <Spinner className="size-3.5" />}
          <span>Lưu quyền truy cập</span>
        </Button>
      </div>
    </div>
  );
}

export default ProjectSharePanel;
