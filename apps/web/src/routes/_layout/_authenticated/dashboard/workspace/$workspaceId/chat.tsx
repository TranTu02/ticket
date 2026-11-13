import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import AiChatPanel from "@/components/ai/ai-chat-panel";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/chat",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();

  return (
    <>
      <PageTitle title={t("ai:pageTitle")} />
      <WorkspaceLayout title={t("ai:pageTitle")}>
        <AiChatPanel workspaceId={workspaceId} />
      </WorkspaceLayout>
    </>
  );
}
