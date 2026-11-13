import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";

type GetWorkspaceUsersRequest = {
  workspaceId?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  filterField?: string;
  filterOperator?: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains";
  filterValue?: string;
};

function useGetWorkspaceUsers({
  workspaceId,
  limit,
  offset,
  sortBy,
  sortDirection,
  filterField,
  filterOperator,
  filterValue,
}: GetWorkspaceUsersRequest) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: [
      "workspace-users",
      workspaceId,
      limit,
      offset,
      sortBy,
      sortDirection,
      filterField,
      filterOperator,
      filterValue,
    ],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await authClient.organization.listMembers({
        query: {
          organizationId: workspaceId,
        },
      });

      if (error) {
        throw new Error(error.message || t("team:members.loadFailed"));
      }

      return data.members;
    },
  });
}

export default useGetWorkspaceUsers;
