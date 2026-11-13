import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";

type RejectInvitationRequest = {
  invitationId: string;
};

function useRejectInvitation() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ invitationId }: RejectInvitationRequest) => {
      const { data, error } = await authClient.organization.rejectInvitation({
        invitationId,
      });

      if (error) {
        throw new Error(error.message || t("team:invitations.rejectFailed"));
      }

      return data;
    },
  });
}

export default useRejectInvitation;
