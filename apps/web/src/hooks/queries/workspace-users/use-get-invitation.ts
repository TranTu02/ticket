import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";

type GetInvitationRequest = {
  invitationId: string;
};

function useGetInvitation({ invitationId }: GetInvitationRequest) {
  const { t } = useTranslation();
  return useQuery({
    queryKey: ["invitation", invitationId],
    enabled: !!invitationId,
    queryFn: async () => {
      const { data, error } = await authClient.organization.getInvitation({
        query: {
          id: invitationId,
        },
      });

      if (error) {
        throw new Error(error.message || t("team:invitations.loadFailed"));
      }

      return data;
    },
  });
}

export default useGetInvitation;
