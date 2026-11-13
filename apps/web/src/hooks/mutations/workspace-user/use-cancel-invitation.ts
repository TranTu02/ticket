import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import queryClient from "@/query-client";

type CancelInvitationRequest = {
  invitationId: string;
  workspaceId: string;
};

function useCancelInvitation() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ invitationId }: CancelInvitationRequest) => {
      const { data, error } = await authClient.organization.cancelInvitation({
        invitationId,
      });

      if (error) {
        throw new Error(error.message || t("team:invitations.cancelFailed"));
      }

      return data;
    },
    onSuccess: (_, { workspaceId }) => {
      // Invalidate all workspace-related queries
      queryClient.invalidateQueries({
        queryKey: ["workspace-invites", workspaceId],
      });

      queryClient.invalidateQueries({
        queryKey: ["workspace", "full", workspaceId],
      });

      queryClient.invalidateQueries({
        queryKey: ["workspace-users", workspaceId],
      });

      // Also invalidate the broader workspace query
      queryClient.invalidateQueries({
        queryKey: ["workspace"],
      });
    },
  });
}

export default useCancelInvitation;
