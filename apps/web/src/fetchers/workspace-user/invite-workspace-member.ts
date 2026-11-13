import { authClient } from "@/lib/auth-client";
import { i18n } from "@/lib/i18n";

export type InviteWorkspaceMemberRequest = {
  workspaceId: string;
  email: string;
  role?: "owner" | "admin" | "member";
};

const inviteWorkspaceMember = async ({
  workspaceId,
  email,
  role = "member",
}: InviteWorkspaceMemberRequest) => {
  const { data, error } = await authClient.organization.inviteMember({
    organizationId: workspaceId,
    email,
    role,
  });

  if (error) {
    throw new Error(error.message || i18n.t("team:invitations.inviteFailed"));
  }

  return data;
};

export default inviteWorkspaceMember;
