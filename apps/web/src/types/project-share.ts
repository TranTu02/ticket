export type ShareType = "all" | "group" | "user";

export interface ActiveGroup {
  id: string;
  name: string;
  memberCount?: number;
  memberIds?: string[];
  members?: Array<{
    id: string;
    userId?: string;
    name: string | null;
    email: string;
  }>;
}

export interface ActiveUser {
  id: string;
  name: string | null;
  email: string;
  role?: string;
  workspaceRole?: string;
  groupName?: string | null;
}

export interface ProjectShareConfig {
  projectId: string;
  shareType: ShareType;
  groupId?: string | null;
  sharedGroupId?: string | null;
  sharedGroupIds?: string[];
  sharedUserIds?: string[];
  group?: ActiveGroup | null;
  users?: ActiveUser[];
  creatorId?: string | null;
  creator?: ActiveUser | null;
}

export interface UpdateProjectShareRequest {
  shareType: ShareType;
  groupId?: string | null;
  sharedGroupId?: string | null;
  sharedGroupIds?: string[];
  sharedUserIds?: string[];
  creatorId?: string | null;
}
