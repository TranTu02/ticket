import { getApiUrl } from "../get-api-url";

export interface DevIdentity {
  identityId: string;
  email: string;
  name: string | null;
  roles: string[];
  groupName: string | null;
  status: string | null;
  hasTicketUser: boolean;
  workspaceId: string | null;
}

async function parseError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    if (body?.message) return String(body.message);
    if (body?.error) return String(body.error);
  } catch {
    // ignore
  }
  return fallback;
}

export async function fetchDevUsers(query?: string): Promise<DevIdentity[]> {
  const params = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  const response = await fetch(getApiUrl(`/dev/users${params}`), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Không tải được danh sách người dùng."));
  }
  const body = (await response.json()) as { users: DevIdentity[] };
  return body.users ?? [];
}

export async function loginAsDevUser(identityId: string): Promise<{
  userId: string;
  email: string;
  workspaceId: string | null;
}> {
  const response = await fetch(getApiUrl("/dev/login"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identityId }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Đăng nhập dev thất bại."));
  }
  return (await response.json()) as {
    userId: string;
    email: string;
    workspaceId: string | null;
  };
}
