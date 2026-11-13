import { useParams } from "@tanstack/react-router";
import { Globe, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { ProjectSharePanel } from "@/components/project-share/project-share-panel";
import { PublicLinkUrlRow } from "@/components/settings/project-visibility/public-link-url-row";
import { useCanShareProject } from "@/components/settings/project-visibility/use-can-share-project";
import { useToggleProjectPublic } from "@/components/settings/project-visibility/use-toggle-project-public";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsNote } from "@/components/settings/settings-note";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { StatusBadge } from "@/components/settings/status-badge";
import { Switch } from "@/components/ui/switch";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export function ProjectVisibilityPage() {
  const { t } = useTranslation();
  const { projectId } = useParams({ strict: false });
  const { data: workspace } = useActiveWorkspace();
  const { data: project } = useGetProject({
    id: projectId || "",
    workspaceId: workspace?.id || "",
  });
  const canShare = useCanShareProject();
  const togglePublic = useToggleProjectPublic(project, workspace?.id);
  const isPublic = Boolean(project?.isPublic);
  const publicUrl = project?.id
    ? `${window.location.origin}/public-project/${project.id}`
    : "";
  const workspaceName =
    workspace?.name ?? t("settings:projectVisibility.thisWorkspace");

  return (
    <>
      <PageTitle title={t("settings:projectVisibility.pageTitle")} />
      <SettingsPage
        title={t("settings:projectVisibility.title")}
        description={
          project?.name
            ? t("settings:projectVisibility.subtitle", {
                project: project.name,
                workspace: workspaceName,
              })
            : undefined
        }
      >
        <SettingsSection title="Chia sẻ theo Nhóm & Người dùng">
          <SettingsCard className="p-6">
            {projectId ? (
              <ProjectSharePanel projectId={projectId} />
            ) : (
              <div className="text-sm text-muted-foreground">
                Không tìm thấy thông tin dự án.
              </div>
            )}
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={t("settings:projectVisibility.sectionTitle")}>
          <SettingsCard>
            <SettingsRow
              icon={<Users />}
              title={t("settings:projectVisibility.membersTitle", {
                workspace: workspaceName,
              })}
              description="Quyền truy cập dự án được quản trị linh hoạt theo cấu hình chia sẻ bên trên."
            >
              <span className="text-xs text-muted-foreground">
                Được quản lý
              </span>
            </SettingsRow>
            <SettingsRow
              icon={<Globe />}
              title={t("settings:projectVisibility.publicAccess")}
              badge={
                isPublic ? (
                  <StatusBadge tone="success">
                    {t("settings:projectVisibility.on")}
                  </StatusBadge>
                ) : null
              }
              description={t("settings:projectVisibility.publicAccessHint")}
            >
              <Switch
                aria-label={t("settings:projectVisibility.publicAccess")}
                checked={isPublic}
                onCheckedChange={canShare ? togglePublic : undefined}
                disabled={!canShare}
              />
            </SettingsRow>
            {isPublic && publicUrl ? (
              <PublicLinkUrlRow url={publicUrl} />
            ) : null}
          </SettingsCard>
          <SettingsNote>{t("settings:projectVisibility.offNote")}</SettingsNote>
        </SettingsSection>
      </SettingsPage>
    </>
  );
}
