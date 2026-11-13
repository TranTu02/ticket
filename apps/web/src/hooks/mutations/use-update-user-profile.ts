import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import invalidateUserProfileQueries from "./invalidate-user-profile-queries";

type UpdateUserProfileRequest = {
  name?: string;
  locale?: string;
};

function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ name, locale }: UpdateUserProfileRequest) => {
      const { data, error } = await authClient.updateUser({
        name,
        locale,
      });

      if (error) {
        throw new Error(error.message || t("settings:profileUpdateFailed"));
      }

      return data;
    },
    onSuccess: () => invalidateUserProfileQueries(queryClient),
  });
}

export default useUpdateUserProfile;
