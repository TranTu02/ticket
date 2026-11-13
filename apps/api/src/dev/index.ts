import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { devLogin, listDevIdentities } from "./dev-user";

// Dev-only auth: chọn user rồi vào luôn, không qua màn hình đăng nhập.
// Mounted on the app (not the authenticated /api router) nên không cần session.
export const devRoutes = new Hono();

const enabled = () =>
  process.env.DEV_AUTH_ENABLED !== "false" &&
  process.env.NODE_ENV !== "production";

devRoutes.get("/users", async (c) => {
  if (!enabled()) return c.json({ users: [] });
  const users = await listDevIdentities(c.req.query("q"));
  return c.json({ users });
});

devRoutes.post("/login", async (c) => {
  if (!enabled())
    throw new HTTPException(404, { message: "Dev auth đang tắt" });

  const body = (await c.req.json().catch(() => null)) as {
    identityId?: string;
  } | null;
  const identityId = body?.identityId?.trim();
  if (!identityId) {
    throw new HTTPException(400, { message: "identityId là bắt buộc" });
  }

  try {
    const result = await devLogin(identityId);
    for (const cookie of result.setCookies) {
      c.header("Set-Cookie", cookie, { append: true });
    }

    return c.json({
      userId: result.userId,
      email: result.email,
      workspaceId: result.workspaceId,
    });
  } catch (error: any) {
    throw new HTTPException(400, {
      message: error?.message || "Đăng nhập dev thất bại",
    });
  }
});
