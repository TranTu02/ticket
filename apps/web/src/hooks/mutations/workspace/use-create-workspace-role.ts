import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";

type CreateWorkspaceRoleRequest = {
  workspaceId: string;
  role: string;
  permission: Record<string, string[]>;
};

function useCreateWorkspaceRole() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      workspaceId,
      role,
      permission,
    }: CreateWorkspaceRoleRequest) => {
      const { data, error } = await authClient.organization.createRole({
        organizationId: workspaceId,
        role,
        permission,
      });
      if (error) {
        throw new Error(error.message || t("workspace:roles.createFailed"));
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-roles", variables.workspaceId],
      });
    },
  });
}

export default useCreateWorkspaceRole;
