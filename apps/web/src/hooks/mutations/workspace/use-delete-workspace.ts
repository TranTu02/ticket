import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";

type DeleteWorkspaceRequest = {
  workspaceId: string;
};

function useDeleteWorkspace() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ workspaceId }: DeleteWorkspaceRequest) => {
      const { data, error } = await authClient.organization.delete({
        organizationId: workspaceId,
      });

      if (error) {
        throw new Error(error.message || t("workspace:deleteFailed"));
      }

      return data;
    },
  });
}

export default useDeleteWorkspace;
