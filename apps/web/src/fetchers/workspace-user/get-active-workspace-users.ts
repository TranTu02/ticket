import { authClient } from "@/lib/auth-client";
import { i18n } from "@/lib/i18n";

export type GetActiveWorkspaceUsersRequest = {
  workspaceId: string;
};

async function getActiveWorkspaceUsers({
  workspaceId,
}: GetActiveWorkspaceUsersRequest) {
  const { data, error } = await authClient.organization.listMembers({
    query: {
      organizationId: workspaceId,
    },
  });

  if (error) {
    throw new Error(error.message || i18n.t("team:members.loadFailed"));
  }

  return data || [];
}

export default getActiveWorkspaceUsers;
