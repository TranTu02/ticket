import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";

type UpdateWorkspaceRoleRequest = {
  workspaceId: string;
  roleName: string;
  permission: Record<string, string[]>;
};

function useUpdateWorkspaceRole() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      workspaceId,
      roleName,
      permission,
    }: UpdateWorkspaceRoleRequest) => {
      const { data, error } = await authClient.organization.updateRole({
        organizationId: workspaceId,
        roleName,
        data: { permission },
      });
      if (error)
        throw new Error(error.message || t("workspace:roles.updateFailed"));
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-roles", variables.workspaceId],
      });
      // The role's permission set just changed, so any cached capability
      // map for members assigned to this role is now stale.
      queryClient.invalidateQueries({
        queryKey: ["workspace-capabilities", variables.workspaceId],
      });
    },
  });
}

export default useUpdateWorkspaceRole;
