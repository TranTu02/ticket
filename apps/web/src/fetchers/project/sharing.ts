import { getApiUrl } from "../get-api-url";
import type {
  ActiveGroup,
  ActiveUser,
  ProjectShareConfig,
  UpdateProjectShareRequest,
} from "@/types/project-share";

async function parseError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = await response.json();
    if (body?.message) return String(body.message);
    if (body?.error) return String(body.error);
  } catch {
    // ignore
  }
  return fallback;
}

export async function fetchSharingGroups(): Promise<ActiveGroup[]> {
  const response = await fetch(getApiUrl("/project/sharing/groups"), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(
      await parseError(response, "Không tải được danh sách nhóm."),
    );
  }
  const data = (await response.json()) as { groups: ActiveGroup[] };
  return data.groups ?? [];
}

export async function fetchSharingUsers(): Promise<ActiveUser[]> {
  const response = await fetch(getApiUrl("/project/sharing/users"), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(
      await parseError(response, "Không tải được danh sách nhân sự."),
    );
  }
  const data = (await response.json()) as { users: ActiveUser[] };
  return data.users ?? [];
}

export async function fetchProjectShare(
  projectId: string,
): Promise<ProjectShareConfig> {
  const response = await fetch(getApiUrl(`/project/${projectId}/share`), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(
      await parseError(response, "Không tải được cấu hình chia sẻ dự án."),
    );
  }
  return (await response.json()) as ProjectShareConfig;
}

export async function updateProjectShare(
  projectId: string,
  payload: UpdateProjectShareRequest,
): Promise<ProjectShareConfig> {
  const response = await fetch(getApiUrl(`/project/${projectId}/share`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(
      await parseError(response, "Cập nhật cấu hình chia sẻ dự án thất bại."),
    );
  }
  return (await response.json()) as ProjectShareConfig;
}
