import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import MembersTable from "@/components/team/members-table";
import useGetFullWorkspace from "@/hooks/queries/workspace/use-get-full-workspace";
import useGetSharingGroups from "@/hooks/queries/project/use-get-sharing-groups";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/members",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { data: workspace } = useGetFullWorkspace({ workspaceId });
  const { data: groups = [], isLoading: groupsLoading } = useGetSharingGroups();
  const [view, setView] = useState<"members" | "groups">("members");

  return (
    <>
      <PageTitle title={t("team:members.pageTitle")} />
      <WorkspaceLayout title={t("team:members.pageTitle")}>
        <div className="space-y-4 p-4">
          <div className="flex gap-2">
            <Button
              variant={view === "members" ? "default" : "outline"}
              onClick={() => setView("members")}
            >
              {t("team:members.users")}
            </Button>
            <Button
              variant={view === "groups" ? "default" : "outline"}
              onClick={() => setView("groups")}
            >
              {t("team:members.groups")}
            </Button>
          </div>
          {view === "members" ? (
            <MembersTable
              workspaceId={workspaceId}
              users={workspace?.members ?? []}
              invitations={workspace?.invitations ?? []}
            />
          ) : groupsLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Đang tải nhóm…</p>
          ) : groups.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Workspace chưa có nhóm.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <article key={group.id} className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 font-medium">
                    <Users className="size-4 text-muted-foreground" />
                    {group.name}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {group.memberCount ?? 0} thành viên
                  </p>
                  <div className="mt-3 border-t pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {t("team:members.members")}
                    </p>
                    {group.members?.length ? (
                      <ul className="max-h-48 space-y-2 overflow-y-auto">
                        {group.members.map((member) => (
                          <li
                            key={member.id}
                            className="flex min-w-0 flex-col text-sm"
                          >
                            <span className="truncate font-medium">
                              {member.name || member.email}
                            </span>
                            {member.name && (
                              <span className="truncate text-xs text-muted-foreground">
                                {member.email}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("team:members.noMembersInGroup")}
                      </p>
                    )}
                  </div>{" "}
                </article>
              ))}
            </div>
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}
