import { authClient } from "@/lib/auth-client";
import { i18n } from "@/lib/i18n";

const getWorkspaces = async () => {
  const { data, error } = await authClient.organization.list();

  if (error) {
    throw new Error(error.message || i18n.t("workspace:listFailed"));
  }

  return data || [];
};

export default getWorkspaces;
