import { getApiUrl } from "@/fetchers/get-api-url";
import { i18n } from "@/lib/i18n";

export async function submitMcpAuthorizationDecision(
  requestId: string,
  approved: boolean,
): Promise<string> {
  const response = await fetch(
    getApiUrl(`/mcp/authorize/request/${encodeURIComponent(requestId)}`),
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    },
  );
  if (!response.ok) {
    throw new Error(i18n.t("auth:mcp.authorizationCompleteFailed"));
  }

  const body = (await response.json()) as { redirect: string };
  return body.redirect;
}
