import { useTranslation } from "react-i18next";
import { useDebouncedCheck } from "@/components/project/code-hosting/use-debounced-check";
import type { RepositoryPath } from "@/components/project/code-hosting/parse-repository-path";
import { useVerifyGithubInstallation } from "@/hooks/mutations/github-integration/use-create-github-integration";

export function useGithubVerification(
  projectId: string,
  repository: RepositoryPath | null,
) {
  const { mutateAsync: verify } = useVerifyGithubInstallation();
  const { t } = useTranslation();
  const key = repository ? `${repository.owner}/${repository.name}` : null;

  return useDebouncedCheck(key, () => {
    if (!repository)
      throw new Error(
        t("settings:githubIntegration.verification.missingRepository"),
      );
    return verify({
      projectId,
      repositoryOwner: repository.owner,
      repositoryName: repository.name,
    });
  });
}
