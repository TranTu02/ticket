import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import queryClient from "@/query-client";

type DeleteWorkspaceUserRequest = {
  workspaceId: string;
  userId: string;
};

function useDeleteWorkspaceUser() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ workspaceId, userId }: DeleteWorkspaceUserRequest) => {
      const { data, error } = await authClient.organization.removeMember({
        memberIdOrEmail: userId,
        organizationId: workspaceId,
      });

      if (error) {
        throw new Error(error.message || t("team:members.removeFailed"));
      }

      return data;
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-invites", workspaceId],
      });

      queryClient.invalidateQueries({
        queryKey: ["workspace", "full", workspaceId],
      });

      queryClient.invalidateQueries({
        queryKey: ["workspace-users", workspaceId],
      });
    },
  });
}

export default useDeleteWorkspaceUser;
