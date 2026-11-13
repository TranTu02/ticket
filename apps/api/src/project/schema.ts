import { z } from "../openapi";

export const projectParam = z.object({ id: z.string() });

export const workspaceIdQuery = z.object({ workspaceId: z.string() });

export const listProjectsQuery = z.object({
  workspaceId: z.string(),
  includeArchived: z.string().optional().openapi({
    description: 'Pass "true" to include archived projects in the list.',
  }),
});

export const createProjectBody = z.object({
  name: z.string(),
  workspaceId: z.string(),
  icon: z.string(),
  slug: z.string(),
  shareType: z.enum(["all", "group", "user"]).optional(),
  groupId: z.string().nullable().optional(),
  sharedGroupId: z.string().nullable().optional(),
  sharedGroupIds: z.array(z.string()).optional(),
  sharedUserIds: z.array(z.string()).optional(),
});

export const updateProjectBody = z.object({
  name: z.string(),
  icon: z.string(),
  slug: z.string(),
  description: z.string(),
  isPublic: z.boolean(),
  includeSubtasks: z.boolean().optional(),
  shareType: z.enum(["all", "group", "user"]).optional(),
  groupId: z.string().nullable().optional(),
  sharedGroupId: z.string().nullable().optional(),
  sharedGroupIds: z.array(z.string()).optional(),
  sharedUserIds: z.array(z.string()).optional(),
});

export const updateProjectShareBody = z.object({
  shareType: z.enum(["all", "group", "user"]).default("all"),
  groupId: z.string().nullable().optional(),
  sharedGroupId: z.string().nullable().optional(),
  sharedGroupIds: z.array(z.string()).optional(),
  sharedUserIds: z.array(z.string()).optional(),
});

export const activeGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  alias: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  memberCount: z.number(),
  memberIds: z.array(z.string()),
  members: z
    .array(
      z.object({
        id: z.string(),
        userId: z.string().optional(),
        name: z.string().nullable(),
        email: z.string(),
      }),
    )
    .optional(),
});

export const activeGroupsResponseSchema = z.object({
  groups: z.array(activeGroupSchema),
});

export const activeUserSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  name: z.string().nullable(),
  email: z.string(),
  groupId: z.string().nullable().optional(),
  groupName: z.string().nullable().optional(),
  groupIds: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  status: z.string(),
});

export const activeUsersResponseSchema = z.object({
  users: z.array(activeUserSchema),
});

export const reorderProjectsBody = z.object({
  // Positions express a relative order only; the controller renumbers the
  // workspace to 0..n-1, so the values just have to be sane.
  projects: z
    .array(z.object({ id: z.string(), position: z.number().int().min(0) }))
    .min(1),
});

export const uploadProjectBackgroundBody = z.object({
  contentType: z.string(),
  size: z.number(),
});

export const finalizeProjectBackgroundBody = z.object({
  key: z.string(),
  contentType: z.string(),
  version: z.string(),
  size: z.number(),
});
export const moveProjectBody = z.object({ workspaceId: z.string().min(1) });
