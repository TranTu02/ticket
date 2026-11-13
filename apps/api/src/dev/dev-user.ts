import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { auth } from "../auth";
import db, { schema } from "../database";

// Dev-only: mật khẩu chung cho mọi user được chọn ở màn hình dev login.
// Chỉ dùng ở môi trường dev; không thay đổi user thật của LIMS.
export const DEV_PASSWORD = process.env.DEV_AUTH_PASSWORD || "dev-password-2026";
export const IRDOP_WORKSPACE_ID = "irdop";
export const IRDOP_WORKSPACE_SLUG = "irdop";
export const IRDOP_WORKSPACE_NAME = "IRDOP";

export interface DevIdentityRow {
  identityId: string;
  email: string;
  name: string | null;
  roles: string[];
  groupName: string | null;
  status: string | null;
  hasTicketUser: boolean;
  workspaceId: string | null;
}

export async function getOrCreateIrdopWorkspace(): Promise<string> {
  const existing = await db
    .select({ id: schema.workspaceTable.id })
    .from(schema.workspaceTable)
    .where(
      sql`${schema.workspaceTable.slug} = ${IRDOP_WORKSPACE_SLUG} or ${schema.workspaceTable.id} = ${IRDOP_WORKSPACE_ID}`,
    )
    .limit(1);

  if (existing[0]) {
    return existing[0].id;
  }

  const now = new Date();
  await db.insert(schema.workspaceTable).values({
    id: IRDOP_WORKSPACE_ID,
    name: IRDOP_WORKSPACE_NAME,
    slug: IRDOP_WORKSPACE_SLUG,
    createdAt: now,
  });

  return IRDOP_WORKSPACE_ID;
}

async function findIdentity(identityId: string) {
  const result = await db.execute(
    sql`select i."identityId", i.email, i."identityName" as name, i."identityRoles" as roles,
               g."identityGroupName" as "groupName", i."identityStatus" as status
          from identity."identities" i
          left join identity."identityGroups" g on g."identityGroupId" = i."identityGroupId"
         where i."identityId" = ${identityId}
           and i."deletedAt" is null
           and lower(coalesce(i."identityStatus", '')) = 'active'
         limit 1`,
  );
  return (result.rows[0] ?? null) as
    | {
        identityId: string;
        email: string;
        name: string | null;
        roles: string[] | null;
        groupName: string | null;
        status: string | null;
      }
    | null;
}

export async function listDevIdentities(query?: string): Promise<DevIdentityRow[]> {
  const search = (query ?? "").trim();
  const like = `%${search.toLowerCase()}%`;
  const result = await db.execute(
    sql`select i."identityId", i.email, i."identityName" as name,
               coalesce(i."identityRoles", '{}') as roles,
               g."identityGroupName" as "groupName", i."identityStatus" as status,
               (u.id is not null) as "hasTicketUser",
               (select wm.workspace_id from workspace_member wm
                 join workspace w on w.id = wm.workspace_id
                where wm.user_id = u.id and (w.slug = 'irdop' or w.id = 'irdop')
                order by wm.joined_at limit 1) as "workspaceId"
          from identity."identities" i
          left join identity."identityGroups" g on g."identityGroupId" = i."identityGroupId"
          left join "user" u on lower(u.email) = lower(i.email)
         where i."deletedAt" is null
           and lower(coalesce(i."identityStatus", '')) = 'active'
           and (${search} = '' or lower(i.email) like ${like} or lower(coalesce(i."identityName", '')) like ${like})
         order by coalesce(i."identityName", i.email)
         limit 500`,
  );
  return result.rows as unknown as DevIdentityRow[];
}

/**
 * Đảm bảo có user trong Kaneo và tự động tham gia workspace IRDOP duy nhất.
 * Password credential được đặt lại thành DEV_PASSWORD (bcrypt) để sign-in
 * server-side; email được coi là đã xác thực để bỏ qua bước gửi OTP.
 * Tuyệt đối không tạo personal workspace mới.
 */
async function ensureTicketUser(identity: {
  identityId: string;
  email: string;
  name: string | null;
}) {
  // better-auth so sánh email ở dạng lowercase; identity LIMS có thể lưu
  // mixed-case nên chuẩn hoá trước khi tạo user/đăng nhập.
  const loginEmail = identity.email.trim().toLowerCase();
  const existing = await db
    .select({ id: schema.userTable.id })
    .from(schema.userTable)
    .where(sql`lower(${schema.userTable.email}) = ${loginEmail}`)
    .limit(1);

  const userId = existing[0]?.id ?? identity.identityId;
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const now = new Date();

  if (!existing[0]) {
    await db.insert(schema.userTable).values({
      id: userId,
      name: identity.name || loginEmail,
      email: loginEmail,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await db
      .update(schema.userTable)
      .set({ email: loginEmail, emailVerified: true, updatedAt: now })
      .where(eq(schema.userTable.id, userId));
  }

  const account = await db
    .select({ id: schema.accountTable.id })
    .from(schema.accountTable)
    .where(eq(schema.accountTable.userId, userId))
    .limit(1);

  if (account[0]) {
    await db
      .update(schema.accountTable)
      .set({ password: passwordHash, updatedAt: now })
      .where(eq(schema.accountTable.id, account[0].id));
  } else {
    await db.insert(schema.accountTable).values({
      id: `dev-account-${userId}`,
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Luôn tham gia duy nhất workspace IRDOP - không tạo personal workspace
  const workspaceId = await getOrCreateIrdopWorkspace();

  const member = await db.execute(
    sql`select id from workspace_member where workspace_id = ${workspaceId} and user_id = ${userId} limit 1`,
  );
  if (!member.rows[0]) {
    await db.execute(
      sql`insert into workspace_member (id, workspace_id, user_id, role, joined_at)
          values (${`wm-${userId}`}, ${workspaceId}, ${userId}, 'member', now())
          on conflict do nothing`,
    );
  }

  // Đồng bộ map vận hành cho AI agent.
  await db.execute(
    sql`insert into service."appUser" ("identityId", "ticketUserId", email, "displayName")
        values (${identity.identityId}, ${userId}, ${identity.email}, ${identity.name})
        on conflict ("identityId") do update
          set "ticketUserId" = excluded."ticketUserId", email = excluded.email,
              "displayName" = excluded."displayName", "updatedAt" = now()`,
  );

  return { userId, workspaceId };
}

export interface DevLoginResult {
  userId: string;
  email: string;
  workspaceId: string | null;
  setCookies: string[];
}

export async function devLogin(identityId: string): Promise<DevLoginResult> {
  const identity = await findIdentity(identityId);
  if (!identity) {
    throw new Error(
      `Không tìm thấy identity ${identityId} hoặc tài khoản không ở trạng thái hoạt động (active)`,
    );
  }

  const { userId, workspaceId } = await ensureTicketUser(identity);

  const response = await auth.api.signInEmail({
    body: { email: identity.email.trim().toLowerCase(), password: DEV_PASSWORD },
    asResponse: true,
  });

  if (!response.ok) {
    throw new Error(`Đăng nhập dev thất bại: ${await response.text()}`);
  }

  // Ensure activeOrganizationId is set to IRDOP on the newly created session
  if (workspaceId) {
    await db.execute(
      sql`update "session" set "active_organization_id" = ${workspaceId} where "user_id" = ${userId}`,
    );
  }

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""].filter(Boolean);

  return { userId, email: identity.email, workspaceId, setCookies };
}
