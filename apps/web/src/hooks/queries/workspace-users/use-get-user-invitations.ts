import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";

function useGetUserInvitations() {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ["user-invitations"],
    queryFn: async () => {
      const { data, error } =
        await authClient.organization.listUserInvitations();

      if (error) {
        throw new Error(
          error.message || t("team:invitations.loadUserInvitationsFailed"),
        );
      }

      return data;
    },
  });
}

export default useGetUserInvitations;
