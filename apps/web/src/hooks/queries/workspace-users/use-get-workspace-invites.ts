import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";

type GetWorkspaceInvitesRequest = {
  workspaceId?: string;
};

function useGetWorkspaceInvites({ workspaceId }: GetWorkspaceInvitesRequest) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ["workspace-invites", workspaceId],
    queryFn: async () => {
      const { data, error } = await authClient.organization.listInvitations({
        query: {
          organizationId: workspaceId,
        },
      });

      if (error) {
        throw new Error(
          error.message || t("team:invitations.loadWorkspaceInvitesFailed"),
        );
      }

      return data;
    },
  });
}

export default useGetWorkspaceInvites;
