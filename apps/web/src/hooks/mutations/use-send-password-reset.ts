import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";

type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

function useChangePassword() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: ChangePasswordRequest) => {
      const { data, error } = await authClient.changePassword({
        currentPassword,
        newPassword,
      });

      if (error) {
        throw new Error(error.message || t("auth:passwordChangeFailed"));
      }

      return data;
    },
  });
}

export default useChangePassword;
