import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToFirstScrollableAncestor,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import {
  ChevronRight,
  CalendarClock,
  CornerDownRight,
  Folder,
  ListTodo,
  Forward,
  MoreHorizontal,
  Plus,
  Settings,
  Trash2,
  Trash2Icon,
} from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ProjectProgress } from "@/components/project-progress";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import icons from "@/constants/project-icons";
import useDeleteProject from "@/hooks/mutations/project/use-delete-project";
import useReorderProjects from "@/hooks/mutations/project/use-reorder-projects";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetAssignedTasks from "@/hooks/queries/task/use-get-assigned-tasks";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { useBoardHoverPrefetch } from "@/hooks/use-board-hover-prefetch";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { EASE_OUT_CSS } from "@/lib/motion";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import type { ProjectWithTasks } from "@/types/project";
import CreateProjectModal from "./shared/modals/create-project-modal";
import ProjectShareModal from "./project-share/project-share-modal";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";

function SortableProjectItem({
  id,
  canReorder,
  children,
}: {
  id: string;
  canReorder: boolean;
  children: ReactNode;
}) {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id,
      disabled: !canReorder,
      // The reorder already moves the row; animating the index change too
      // replays the same move from a stale offset.
      animateLayoutChanges: () => false,
      // dnd-kit defaults to `ease`; this is the app's curve.
      transition: { duration: 200, easing: EASE_OUT_CSS },
    });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    // `listeners` without `attributes`: the latter puts role="button" and a tab
    // stop on the row, wrapping the link and the dropdown inside it.
    <SidebarMenuItem
      ref={setNodeRef}
      style={style}
      data-kaneo-sortable=""
      className={isDragging ? "opacity-0" : undefined}
      {...(canReorder ? listeners : {})}
    >
      {children}
    </SidebarMenuItem>
  );
}

function flattenTaskTree(tasks: AssignedTask[]) {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const childrenByParent = new Map<string, AssignedTask[]>();

  for (const task of tasks) {
    if (!task.parentTaskId || !tasksById.has(task.parentTaskId)) continue;
    const children = childrenByParent.get(task.parentTaskId) ?? [];
    children.push(task);
    childrenByParent.set(task.parentTaskId, children);
  }

  const flattened: Array<{ task: AssignedTask; depth: number }> = [];
  const visited = new Set<string>();
  const append = (task: AssignedTask, depth: number) => {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    flattened.push({ task, depth });
    for (const child of childrenByParent.get(task.id) ?? []) {
      append(child, depth + 1);
    }
  };

  for (const task of tasks) {
    if (!task.parentTaskId || !tasksById.has(task.parentTaskId))
      append(task, 0);
  }
  for (const task of tasks) append(task, 0);

  return flattened;
}

export function NavProjects() {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const { data: workspace } = useActiveWorkspace();
  const { data: relatedTasks } = useGetAssignedTasks(workspace?.id);
  const pathname = useLocation({
    select: (location) => location.pathname.replace(/\/+$/, ""),
  });
  const { data: projects } = useGetProjects(
    {
      workspaceId: workspace?.id || "",
    },
    true,
  );
  const queryClient = useQueryClient();
  const { mutateAsync: deleteProject } = useDeleteProject();
  const reorderProjects = useReorderProjects();
  const { canCreateProjects, canDeleteProjects, canUpdateProjects } =
    useWorkspacePermission();
  const canCreate = canCreateProjects();
  const canDeleteProject = canDeleteProjects();
  // Matches the API, which gates /project/reorder on `project: ["update"]`
  // alone—not the create+update+delete bundle.
  const canReorder = canUpdateProjects();
  const navigate = useNavigate();
  const boardHoverPrefetch = useBoardHoverPrefetch(workspace?.id ?? "");
  const { workspaceId: currentWorkspaceId, projectId: currentProjectId } =
    useParams({
      strict: false,
    });
  const { taskId: currentTaskId } = useParams({ strict: false });

  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false);
  const [isDeleteProjectModalOpen, setIsDeleteProjectModalOpen] =
    useState(false);
  const [projectToShare, setProjectToShare] = useState<ProjectWithTasks | null>(
    null,
  );
  const [projectToDeleteId, setProjectToDeleteID] = useState<string | null>(
    null,
  );
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(
    null,
  );

  const draggingProject = projects?.find(
    (project) => project.id === draggingProjectId,
  );
  const sidebarTasks = flattenTaskTree(relatedTasks?.tasks ?? []);

  const isCurrentProject = (projectId: string) => {
    return (
      currentProjectId === projectId && currentWorkspaceId === workspace?.id
    );
  };

  const handleProjectClick = (project: ProjectWithTasks) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: {
        workspaceId: workspace?.id || "",
        projectId: project.id,
      },
    });
  };

  // Below these thresholds the row is still a link and the sidebar still
  // scrolls; above them the gesture becomes a drag.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    document.body.classList.add("kaneo-dragging");
    setDraggingProjectId(String(event.active.id));
  };

  const endDrag = () => {
    document.body.classList.remove("kaneo-dragging");
    setDraggingProjectId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    endDrag();

    if (!over || active.id === over.id || !projects || !workspace) return;

    const oldIndex = projects.findIndex((project) => project.id === active.id);
    const newIndex = projects.findIndex((project) => project.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(projects, oldIndex, newIndex);

    reorderProjects(workspace.id, reordered, {
      onError: () => {
        toast.error(t("workspace:projects.reorderError"));
      },
    });
  };

  if (!workspace) return null;

  return (
    <>
      <Collapsible defaultOpen>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden gap-1 p-2 pt-1">
          <CollapsibleTrigger
            className="data-panel-open:[&_svg]:rotate-90"
            render={
              <SidebarGroupLabel className="h-7 cursor-pointer justify-start gap-1 px-0 text-sidebar-accent-foreground" />
            }
          >
            <span>Tasks</span>
            <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/60 transition-transform duration-200" />
          </CollapsibleTrigger>
          {canCreate && (
            <SidebarGroupAction
              className="top-2 right-2 text-sidebar-foreground/70"
              title={t("navigation:projectList.addProject")}
              onClick={() => setIsCreateProjectModalOpen(true)}
            >
              <Plus />
              <span className="sr-only">
                {t("navigation:projectList.addProject")}
              </span>
            </SidebarGroupAction>
          )}
          <CollapsiblePanel className="-m-1 p-1">
            <SidebarGroupContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[
                  restrictToVerticalAxis,
                  restrictToFirstScrollableAncestor,
                ]}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={endDrag}
              >
                <SidebarMenu className="gap-0.5">
                  <SortableContext
                    items={projects?.map((project) => project.id) ?? []}
                    strategy={verticalListSortingStrategy}
                  >
                    {projects?.map((project) => {
                      const ProjectIcon =
                        icons[project.icon as keyof typeof icons] ||
                        icons.Layout;

                      return (
                        <SortableProjectItem
                          key={project.id}
                          id={project.id}
                          canReorder={canReorder}
                        >
                          <SidebarMenuButton
                            isActive={isCurrentProject(project.id)}
                            size="default"
                            className="h-8 text-sm"
                            onClick={() => handleProjectClick(project)}
                            {...boardHoverPrefetch(project.id)}
                          >
                            <ProjectIcon aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate">
                              {project.name}
                            </span>
                            {/* Gives way to the row menu, which sits here on hover. */}
                            <ProjectProgress
                              percentage={
                                project.statistics.completionPercentage
                              }
                              className="text-muted-foreground max-md:hidden group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0 group-has-data-popup-open/menu-item:opacity-0"
                            />
                          </SidebarMenuButton>

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  // The row is the drag source; this press
                                  // must not reach it.
                                  onPointerDown={(event) =>
                                    event.stopPropagation()
                                  }
                                  className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-hidden ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground after:-inset-2 after:absolute md:after:hidden [&>svg]:size-4 group-data-[collapsible=icon]:hidden group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-popup-open:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0"
                                />
                              }
                            >
                              <MoreHorizontal />
                              <span className="sr-only">
                                {t("navigation:sidebar.more")}
                              </span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              className="min-w-44 rounded-lg"
                              side={isMobile ? "bottom" : "right"}
                              align={isMobile ? "end" : "start"}
                            >
                              <DropdownMenuItem
                                className="h-7 items-start cursor-pointer text-sm"
                                onClick={() => handleProjectClick(project)}
                              >
                                <Folder className="text-muted-foreground" />
                                <span>
                                  {t("navigation:projectList.viewProject")}
                                </span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="h-7 items-start cursor-pointer text-sm"
                                onClick={() => {
                                  setProjectToShare(project);
                                }}
                              >
                                <Forward className="text-muted-foreground" />
                                <span>
                                  {t("navigation:projectList.shareProject")}
                                </span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="h-7 items-start cursor-pointer text-sm"
                                onClick={() => {
                                  navigate({
                                    to: "/dashboard/settings/projects/$projectId/general",
                                    params: { projectId: project.id },
                                  });
                                }}
                              >
                                <Settings className="text-muted-foreground" />
                                <span>
                                  {t("navigation:projectList.projectSettings")}
                                </span>
                              </DropdownMenuItem>
                              {canDeleteProject && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="h-7 items-start text-destructive cursor-pointer text-sm"
                                    onClick={() => {
                                      setProjectToDeleteID(project.id);
                                      setIsDeleteProjectModalOpen(true);
                                    }}
                                  >
                                    <Trash2 className="text-destructive" />
                                    <span>
                                      {t(
                                        "navigation:projectList.deleteProject",
                                      )}
                                    </span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </SortableProjectItem>
                      );
                    })}
                  </SortableContext>
                </SidebarMenu>

                {/* Portalled: `SidebarContent` is `overflow-auto` and clips it. */}
                {createPortal(
                  <DragOverlay dropAnimation={null}>
                    {draggingProject ? (
                      <div className="flex h-8 w-(--sidebar-width) max-w-64 items-center rounded-lg border bg-sidebar not-dark:bg-clip-padding px-2 text-sm text-sidebar-accent-foreground shadow-lg/5">
                        <span className="truncate">{draggingProject.name}</span>
                      </div>
                    ) : null}
                  </DragOverlay>,
                  document.body,
                )}
              </DndContext>
            </SidebarGroupContent>
          </CollapsiblePanel>
        </SidebarGroup>
      </Collapsible>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden gap-1 p-2 pt-1">
        <SidebarGroupLabel className="h-7 px-2 text-sidebar-foreground/70">
          All tasks
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="All tasks"
                isActive={pathname.endsWith("/my-tasks")}
                size="sm"
                onClick={() =>
                  navigate({
                    to: "/dashboard/workspace/$workspaceId/my-tasks",
                    params: { workspaceId: workspace.id },
                  })
                }
              >
                <ListTodo aria-hidden="true" />
                <span>All tasks</span>
                {relatedTasks?.total ? (
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {relatedTasks.total > 99 ? "99+" : relatedTasks.total}
                  </span>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
            {sidebarTasks.map(({ task, depth }) => (
              <SidebarMenuItem key={task.id}>
                <SidebarMenuButton
                  tooltip={task.title}
                  isActive={currentTaskId === task.id}
                  aria-level={depth + 1}
                  size="sm"
                  className="h-auto min-h-12 items-start py-1.5"
                  style={{
                    paddingInlineStart: `${8 + depth * 12}px`,
                  }}
                  onClick={() =>
                    navigate({
                      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
                      params: {
                        workspaceId: workspace.id,
                        projectId: task.projectId,
                        taskId: task.id,
                      },
                    })
                  }
                >
                  {depth > 0 && (
                    <CornerDownRight
                      aria-hidden="true"
                      className="size-3 text-muted-foreground"
                    />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-xs font-medium">
                      {task.title}
                    </span>
                    <span className="flex min-w-0 items-center gap-1 text-[10px] font-normal text-muted-foreground">
                      <time
                        dateTime={task.createdAt}
                        title={formatDateTime(task.createdAt)}
                        className="flex shrink-0 items-center gap-1"
                      >
                        <CalendarClock className="size-3" />
                        {formatRelativeTime(task.createdAt)}
                      </time>
                      <span aria-hidden="true">·</span>
                      <span className="min-w-0 truncate">
                        {task.creatorName || "Unknown creator"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="flex shrink-0 items-center gap-0.5">
                        {getPriorityIcon(task.priority)}
                        {getPriorityLabel(task.priority)}
                      </span>
                    </span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <CreateProjectModal
        open={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
      />

      <AlertDialog
        open={isDeleteProjectModalOpen}
        onOpenChange={setIsDeleteProjectModalOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("navigation:projectList.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("navigation:projectList.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await deleteProject({
                      id: projectToDeleteId || "",
                    });
                    toast.success(t("navigation:projectList.deletedToast"), {
                      icon: Trash2Icon,
                    });
                    queryClient.invalidateQueries({
                      queryKey: ["projects"],
                    });
                    navigate({
                      to: "/dashboard/workspace/$workspaceId",
                      params: {
                        workspaceId: workspace?.id || "",
                      },
                    });
                  }}
                />
              }
            >
              {t("navigation:projectList.deleteProject")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProjectShareModal
        open={Boolean(projectToShare)}
        onClose={() => setProjectToShare(null)}
        projectId={projectToShare?.id || ""}
        projectName={projectToShare?.name}
      />
    </>
  );
}
