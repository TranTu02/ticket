import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";

type UpdateWorkspaceRequest = {
  workspaceId: string;
  name?: string;
  description?: string;
  slug?: string;
  logo?: string;
  metadata?: Record<string, unknown>;
};

function useUpdateWorkspace() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      workspaceId,
      name,
      description,
      slug,
      logo,
      metadata,
    }: UpdateWorkspaceRequest) => {
      const updateData: {
        name?: string;
        description?: string;
        slug?: string;
        logo?: string;
        metadata?: Record<string, unknown>;
      } = {};

      if (name !== undefined) {
        updateData.name = name;
      }

      if (slug !== undefined) {
        updateData.slug = slug;
      }

      if (description !== undefined) {
        updateData.description = description;
      }

      if (logo !== undefined) {
        updateData.logo = logo;
      }

      if (metadata !== undefined) {
        updateData.metadata = metadata;
      }

      const { data, error } = await authClient.organization.update({
        data: updateData,
        organizationId: workspaceId,
      });

      if (error) {
        throw new Error(error.message || t("workspace:updateFailed"));
      }

      return data;
    },
  });
}

export default useUpdateWorkspace;
