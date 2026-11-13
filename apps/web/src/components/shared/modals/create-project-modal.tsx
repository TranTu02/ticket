import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Globe, SquarePlusIcon, UserCheck, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import icons from "@/constants/project-icons";
import useCreateProject from "@/hooks/mutations/project/use-create-project";
import useGetSharingGroups from "@/hooks/queries/project/use-get-sharing-groups";
import useGetSharingUsers from "@/hooks/queries/project/use-get-sharing-users";
import { prefetchBoard } from "@/hooks/queries/task/prefetch-board";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useCanImport } from "@/hooks/use-can-import";
import { cn } from "@/lib/cn";
import generateProjectSlug from "@/lib/generate-project-id";
import { toast } from "@/lib/toast";

type CreateProjectModalProps = {
  open: boolean;
  onClose: () => void;
};

function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("Layout");
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [shareType, setShareType] = useState<"all" | "group" | "user">("all");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();
  const { canImport } = useCanImport();

  const { data: groups = [] } = useGetSharingGroups(open);
  const { data: users = [] } = useGetSharingUsers(open);

  const { mutateAsync } = useCreateProject({
    name,
    slug,
    workspaceId: workspace?.id ?? "",
    icon: selectedIcon,
    shareType,
    groupId: shareType === "group" ? selectedGroupId : null,
    sharedGroupId: shareType === "group" ? selectedGroupId : null,
    sharedGroupIds:
      shareType === "group" && selectedGroupId ? [selectedGroupId] : [],
    sharedUserIds: shareType === "user" ? selectedUserIds : [],
  });
  const SelectedIcon =
    icons[selectedIcon as keyof typeof icons] || icons.Layout;
  const filteredIcons = Object.entries(icons).filter(([iconName]) =>
    iconName.toLowerCase().includes(iconSearch.trim().toLowerCase()),
  );
  const navigate = useNavigate();

  const handleClose = () => {
    setName("");
    setSlug("");
    setSelectedIcon("Layout");
    setShareType("all");
    setSelectedGroupId(null);
    setSelectedUserIds([]);
    setIconPopoverOpen(false);
    setIconSearch("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const { id } = await mutateAsync();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        prefetchBoard(queryClient, id),
      ]);

      await navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
        params: {
          workspaceId: workspace?.id ?? "",
          projectId: id,
        },
      });

      toast.success("Project created successfully", { icon: SquarePlusIcon });
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:modals.createProject.errorToast"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    setSlug(generateProjectSlug(newName));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader className="px-3 pt-4 pb-1 gap-1.5">
          <DialogTitle className="sr-only">
            {t("common:modals.createProject.title")}
          </DialogTitle>
          <Breadcrumb>
            <BreadcrumbList className="gap-1 text-xs">
              <BreadcrumbItem className="text-muted-foreground font-medium tracking-wide">
                {workspace?.name?.toUpperCase() ||
                  t("common:modals.createProject.workspaceFallback")}
              </BreadcrumbItem>
              <BreadcrumbSeparator className="[&>svg]:size-3.5" />
              <BreadcrumbItem className="text-foreground font-medium">
                {t("common:modals.createProject.breadcrumbNew")}
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <DialogDescription className="sr-only">
            {t("common:modals.createProject.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-6 px-3 pt-2">
            <Popover
              open={iconPopoverOpen}
              onOpenChange={(open) => {
                setIconPopoverOpen(open);
                if (!open) setIconSearch("");
              }}
              modal={true}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="h-8 w-8 p-0"
                  title={t("common:modals.createProject.pickIcon")}
                >
                  <SelectedIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-2">
                  <Input
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder={t("common:modals.createProject.searchIcons")}
                    className="h-8 text-base sm:text-xs"
                  />
                  <div className="max-h-[280px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-6 gap-1.5">
                      {filteredIcons.map(([iconName, Icon]) => {
                        const isSelected = selectedIcon === iconName;
                        return (
                          <Button
                            key={iconName}
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedIcon(iconName);
                              setIconPopoverOpen(false);
                              setIconSearch("");
                            }}
                            className={cn(
                              "h-10 items-center justify-center rounded-md p-0",
                              isSelected &&
                                "bg-sidebar-accent text-sidebar-accent-foreground",
                            )}
                            title={iconName}
                          >
                            <Icon className="h-4 w-4" />
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Input
              unstyled
              value={name}
              onChange={handleNameChange}
              autoFocus
              placeholder={t("common:modals.createProject.projectName")}
              className="w-full [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-0 [&_[data-slot=input]]:py-2 [&_[data-slot=input]]:text-2xl [&_[data-slot=input]]:leading-tight [&_[data-slot=input]]:font-semibold [&_[data-slot=input]]:tracking-tight [&_[data-slot=input]]:text-foreground [&_[data-slot=input]]:placeholder:text-muted-foreground [&_[data-slot=input]]:outline-none"
              required
            />
          </div>

          <div className="space-y-3 px-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {t("common:modals.createProject.keyLabel")}
                </span>
                <Input
                  id="project-key"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="PRO"
                  maxLength={8}
                  className="w-20 h-8 text-center font-semibold text-base sm:text-sm bg-background border-border rounded-lg transition-colors duration-150"
                  required
                />
              </div>
              <div className="flex-1 text-xs text-muted-foreground opacity-80">
                {t("common:modals.createProject.keyHint", {
                  example: slug || "ABC",
                })}
              </div>
            </div>

            {/* Project Access Sharing */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-medium text-foreground">
                Quyền truy cập dự án
              </label>
              <div className="grid grid-cols-3 gap-1.5 rounded-lg border bg-muted/40 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setShareType("all")}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-md py-1.5 font-medium transition-colors",
                    shareType === "all"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Globe className="size-3.5" />
                  <span>Toàn bộ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShareType("group")}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-md py-1.5 font-medium transition-colors",
                    shareType === "group"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Users className="size-3.5" />
                  <span>Theo Nhóm</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShareType("user")}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-md py-1.5 font-medium transition-colors",
                    shareType === "user"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <UserCheck className="size-3.5" />
                  <span>Người dùng</span>
                </button>
              </div>

              {shareType === "group" && (
                <div className="space-y-1.5 pt-1">
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    value={selectedGroupId || ""}
                    onChange={(e) => setSelectedGroupId(e.target.value || null)}
                  >
                    <option value="">-- Chọn nhóm nhân sự --</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}{" "}
                        {group.memberCount !== undefined
                          ? `(${group.memberCount} thành viên)`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Chỉ các nhân sự thuộc nhóm được chọn mới có quyền truy cập
                    dự án này.
                  </p>
                </div>
              )}

              {shareType === "user" && (
                <div className="space-y-1.5 pt-1">
                  <div className="max-h-36 overflow-y-auto rounded-md border p-1 divide-y divide-border/50 text-xs">
                    {users.map((user) => {
                      const isSelected = selectedUserIds.includes(user.id);
                      return (
                        <div
                          key={user.id}
                          onClick={() => {
                            setSelectedUserIds((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== user.id)
                                : [...prev, user.id],
                            );
                          }}
                          className={cn(
                            "flex items-center justify-between p-1.5 cursor-pointer rounded transition-colors",
                            isSelected
                              ? "bg-primary/10 text-foreground font-medium"
                              : "hover:bg-muted/50 text-muted-foreground",
                          )}
                        >
                          <span className="truncate">{user.name || user.email}</span>
                          {user.groupName && (
                            <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                              {user.groupName}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Đã chọn {selectedUserIds.length} nhân sự</span>
                    {selectedUserIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedUserIds([])}
                        className="text-primary hover:underline"
                      >
                        Bỏ chọn
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {canImport && (
              <p className="text-muted-foreground text-xs">
                {t("settings:workspaceImport.entry.createProjectPrompt")}{" "}
                <Link
                  to="/dashboard/settings/workspace/import"
                  onClick={handleClose}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {t("settings:workspaceImport.entry.createProjectLink")}
                </Link>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              size="sm"
              className="border-border text-foreground hover:bg-accent"
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !slug.trim()}
              loading={isSubmitting}
              size="sm"
              className="bg-primary hover:bg-primary/90  disabled:opacity-50"
            >
              {t("common:modals.createProject.createButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateProjectModal;
