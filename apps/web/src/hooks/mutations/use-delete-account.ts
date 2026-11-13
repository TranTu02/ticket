import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";

export const SESSION_TOO_OLD = "SESSION_TOO_OLD";

function useDeleteAccount() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await authClient.deleteUser();

      if (error) {
        if (error.code === "SESSION_EXPIRED") {
          throw new Error(SESSION_TOO_OLD);
        }

        throw new Error(
          error.message || t("settings:informationPage.deleteAccount.error"),
        );
      }

      return data;
    },
  });
}

export default useDeleteAccount;
