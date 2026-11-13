import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";

type GetFullWorkspaceRequest = {
  workspaceId?: string;
  workspaceSlug?: string;
  membersLimit?: number;
};

function useGetFullWorkspace({
  workspaceId,
  workspaceSlug,
  membersLimit = 100,
}: GetFullWorkspaceRequest) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ["workspace", "full", workspaceId || workspaceSlug],
    enabled: !!(workspaceId || workspaceSlug),
    queryFn: async () => {
      const { data, error } = await authClient.organization.getFullOrganization(
        {
          query: {
            organizationId: workspaceId,
            membersLimit,
          },
        },
      );

      if (error) {
        throw new Error(error.message || t("workspace:loadFailed"));
      }

      return data;
    },
  });
}

export default useGetFullWorkspace;
