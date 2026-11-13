import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import deleteAvatar from "@/fetchers/user/delete-avatar";
import { authClient } from "@/lib/auth-client";
import invalidateUserProfileQueries from "./invalidate-user-profile-queries";

function useRemoveUserAvatar() {
  const queryClient = useQueryClient();

  const { t } = useTranslation();
  return useMutation({
    mutationFn: async () => {
      const { error } = await authClient.updateUser({ image: null });

      if (error) {
        throw new Error(
          error.message || t("settings:informationPage.avatar.removeError"),
        );
      }

      return deleteAvatar();
    },
    onSuccess: () => invalidateUserProfileQueries(queryClient),
  });
}

export default useRemoveUserAvatar;
