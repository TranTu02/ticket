import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";

type AcceptInvitationRequest = {
  invitationId: string;
};

function useAcceptInvitation() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ invitationId }: AcceptInvitationRequest) => {
      const { data, error } = await authClient.organization.acceptInvitation({
        invitationId,
      });

      if (error) {
        throw new Error(error.message || t("team:invitations.acceptFailed"));
      }

      return data;
    },
  });
}

export default useAcceptInvitation;
