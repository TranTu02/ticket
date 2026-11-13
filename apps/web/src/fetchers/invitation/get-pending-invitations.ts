import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { WorkspaceUserInvitation } from "@/types/workspace-user";
import { i18n } from "@/lib/i18n";

export async function getPendingInvitations(): Promise<
  WorkspaceUserInvitation[]
> {
  const response = await client.invitation.pending.$get();

  if (!response.ok) {
    throw new HttpError(
      response.status,
      i18n.t("team:invitations.pendingLoadFailed"),
    );
  }

  return response.json();
}
