import { getApiUrl } from "@/fetchers/get-api-url";
import { i18n } from "@/lib/i18n";

export type McpAuthorizationRequest = {
  clientName: string;
  redirectUri: string;
};

export async function getMcpAuthorizationRequest(
  requestId: string,
): Promise<McpAuthorizationRequest> {
  const response = await fetch(
    getApiUrl(`/mcp/authorize/request/${encodeURIComponent(requestId)}`),
    { credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(i18n.t("auth:mcp.authorizationInvalidOrExpired"));
  }

  const body = (await response.json()) as {
    client_name: string;
    redirect_uri: string;
  };
  return {
    clientName: body.client_name,
    redirectUri: body.redirect_uri,
  };
}
