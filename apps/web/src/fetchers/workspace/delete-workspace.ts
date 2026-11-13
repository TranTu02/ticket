import { authClient } from "@/lib/auth-client";
import { i18n } from "@/lib/i18n";

type DeleteWorkspaceRequest = {
  id: string;
};

const deleteWorkspace = async ({ id }: DeleteWorkspaceRequest) => {
  const { data, error } = await authClient.organization.delete({
    organizationId: id,
  });

  if (error) {
    throw new Error(error.message || i18n.t("workspace:deleteFailed"));
  }

  return data;
};

export default deleteWorkspace;
