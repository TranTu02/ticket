import { Hono } from "hono";
import {
  listActiveGroups,
  listActiveUsers,
  getProjectShare,
  updateProjectShare,
} from "./controllers/project-sharing";
import { getTaskShare, updateTaskShare } from "../task/controllers/update-task";

export const projectAccessRoutes = new Hono();

/**
 * Workspace used for the share grants written by these legacy routes.
 *
 * The routes were originally bound to a hard-coded workspace slug; callers may
 * now pass `?workspaceId=` to scope writes to the workspace they are actually
 * in. The literal stays as the fallback so existing clients keep working.
 */
const FALLBACK_WORKSPACE_ID = "irdop";

function resolveWorkspaceId(c: {
  req: { query: (key: string) => string | undefined };
}) {
  const fromQuery = c.req.query("workspaceId")?.trim();
  return fromQuery || FALLBACK_WORKSPACE_ID;
}

type ProjectShareBody = {
  shareType: "all" | "group" | "user";
  groupId?: string | null;
  sharedGroupId?: string | null;
  sharedGroupIds?: string[];
  sharedUserIds?: string[];
  creatorId?: string | null;
};

type TaskShareBody = ProjectShareBody;

projectAccessRoutes.get("/groups", async (c) => {
  const groups = await listActiveGroups();
  return c.json({ groups }, 200);
});

projectAccessRoutes.get("/users", async (c) => {
  const users = await listActiveUsers();
  return c.json({ users }, 200);
});

projectAccessRoutes.get("/task/:id", async (c) => {
  const id = c.req.param("id");
  const share = await getTaskShare(id);
  return c.json(share, 200);
});

projectAccessRoutes.put("/task/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as TaskShareBody;
  const share = await updateTaskShare(id, body);
  return c.json(share, 200);
});

// Same handlers under the canonical `/{id}/share` path used by the task routes,
// so both mounts return an identical payload.
projectAccessRoutes.get("/task/:id/share", async (c) => {
  const id = c.req.param("id");
  const share = await getTaskShare(id);
  return c.json(share, 200);
});

projectAccessRoutes.put("/task/:id/share", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as TaskShareBody;
  const share = await updateTaskShare(id, body);
  return c.json(share, 200);
});

projectAccessRoutes.get("/:id/share", async (c) => {
  const id = c.req.param("id");
  const share = await getProjectShare(id, resolveWorkspaceId(c));
  return c.json(share, 200);
});

projectAccessRoutes.put("/:id/share", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as ProjectShareBody;
  const share = await updateProjectShare(id, resolveWorkspaceId(c), body);
  return c.json(share, 200);
});

projectAccessRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const share = await getProjectShare(id, resolveWorkspaceId(c));
  return c.json(share, 200);
});

projectAccessRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as ProjectShareBody;
  const share = await updateProjectShare(id, resolveWorkspaceId(c), body);
  return c.json(share, 200);
});

export default projectAccessRoutes;
