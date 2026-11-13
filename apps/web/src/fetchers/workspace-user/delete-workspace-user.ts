import { authClient } from "@/lib/auth-client";
import { i18n } from "@/lib/i18n";

export type DeleteWorkspaceUserRequest = {
  workspaceId: string;
  userId: string;
};

async function deleteWorkspaceUser({
  workspaceId,
  userId,
}: DeleteWorkspaceUserRequest) {
  const { data, error } = await authClient.organization.removeMember({
    organizationId: workspaceId,
    memberIdOrEmail: userId,
  });

  if (error) {
    throw new Error(error.message || i18n.t("team:members.removeFailed"));
  }

  return data;
}

export default deleteWorkspaceUser;
