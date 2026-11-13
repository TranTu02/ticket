import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type CreateProjectRequest = {
  name: string;
  slug: string;
  workspaceId: string;
  icon?: string;
  shareType?: "all" | "group" | "user";
  groupId?: string | null;
  sharedGroupId?: string | null;
  sharedGroupIds?: string[];
  sharedUserIds?: string[];
};

async function createProject({
  name,
  slug,
  workspaceId,
  icon,
  shareType,
  groupId,
  sharedGroupId,
  sharedGroupIds,
  sharedUserIds,
}: CreateProjectRequest) {
  const response = await client.project.$post({
    json: {
      name,
      slug,
      icon: icon || "Layout",
      workspaceId,
      ...(shareType ? { shareType } : {}),
      ...(groupId ? { groupId } : {}),
      ...(sharedGroupId ? { sharedGroupId } : {}),
      ...(sharedGroupIds ? { sharedGroupIds } : {}),
      ...(sharedUserIds ? { sharedUserIds } : {}),
    } as any,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default createProject;
