import type { ActiveGroup, ActiveUser } from "@/types/project-share";

export interface TaskShareCreator {
  id: string;
  name: string | null;
  email: string;
}

export type TaskShareVisibility = "public" | "private";

export interface TaskShareConfig {
  taskId: string;
  creatorId?: string | null;
  creatorName?: string | null;
  creator?: TaskShareCreator | null;
  shareType: TaskShareVisibility;
  groupId?: string | null;
  sharedGroupId?: string | null;
  sharedGroupIds?: string[];
  sharedUserIds?: string[];
  assigneeIds?: string[];
  group?: ActiveGroup | null;
  users?: ActiveUser[];
}

export interface UpdateTaskShareRequest {
  shareType: TaskShareVisibility;
  groupId?: string | null;
  sharedGroupId?: string | null;
  sharedGroupIds?: string[];
  sharedUserIds?: string[];
}
