import { getApiUrl } from "../get-api-url";

export interface AiAgentOption {
  id: string;
  name: string;
  description: string;
}

export interface AiConversation {
  conversationId: string;
  agentId: string;
  title: string | null;
  status: string;
  threadId: string | null;
  workspaceId: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  messageId: string;
  conversationId: string;
  role: string;
  content: string;
  status: string;
  agentId: string | null;
  runId: string | null;
  createdAt: string;
}

async function parseError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    if (body?.message) return String(body.message);
    if (body?.error) return String(body.error);
  } catch {
    // ignore
  }
  return fallback;
}

export async function fetchAiAgents(): Promise<AiAgentOption[]> {
  const response = await fetch(getApiUrl("/ai/agents"), {
    credentials: "include",
  });
  if (!response.ok)
    throw new Error(
      await parseError(response, "Không tải được danh sách agent."),
    );
  const body = (await response.json()) as { agents: AiAgentOption[] };
  return body.agents ?? [];
}

export async function fetchAiConversations(
  workspaceId: string,
): Promise<AiConversation[]> {
  const response = await fetch(
    getApiUrl(
      `/ai/conversations?workspaceId=${encodeURIComponent(workspaceId)}`,
    ),
    { credentials: "include" },
  );
  if (!response.ok)
    throw new Error(await parseError(response, "Không tải được hội thoại."));
  const body = (await response.json()) as { conversations: AiConversation[] };
  return body.conversations ?? [];
}

export async function createAiConversation(input: {
  agentId: string;
  workspaceId: string;
  projectId?: string;
  title?: string;
}): Promise<AiConversation> {
  const response = await fetch(getApiUrl("/ai/conversations"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok)
    throw new Error(await parseError(response, "Không tạo được hội thoại."));
  const body = (await response.json()) as { conversation: AiConversation };
  return body.conversation;
}

export async function fetchAiMessages(
  conversationId: string,
): Promise<AiMessage[]> {
  const response = await fetch(
    getApiUrl(
      `/ai/conversations/${encodeURIComponent(conversationId)}/messages`,
    ),
    { credentials: "include" },
  );
  if (!response.ok)
    throw new Error(await parseError(response, "Không tải được tin nhắn."));
  const body = (await response.json()) as { messages: AiMessage[] };
  return body.messages ?? [];
}

export type AiStreamEvent =
  | { type: "start"; runId: string }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; latencyMs: number }
  | { type: "error"; message: string };

/**
 * Gửi tin nhắn tới ticket API; server gọi AI platform ở 4111 và stream lại
 * event delta/done. Không dùng EventSource vì cần POST + cookie.
 */
export async function streamAiMessage(input: {
  conversationId: string;
  content: string;
  signal?: AbortSignal;
  onEvent: (event: AiStreamEvent) => void;
}): Promise<void> {
  const response = await fetch(
    getApiUrl(
      `/ai/conversations/${encodeURIComponent(input.conversationId)}/messages`,
    ),
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input.content }),
      signal: input.signal,
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response, "Không gửi được tin nhắn."));
  }
  if (!response.body) throw new Error("Server không trả về stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleBlock = (block: string) => {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) return;
    try {
      const payload = JSON.parse(data) as Record<string, unknown>;
      if (event === "delta" && typeof payload.text === "string") {
        input.onEvent({ type: "delta", text: payload.text });
      } else if (event === "start" && typeof payload.runId === "string") {
        input.onEvent({ type: "start", runId: payload.runId });
      } else if (event === "done") {
        input.onEvent({
          type: "done",
          messageId: String(payload.messageId ?? ""),
          latencyMs: Number(payload.latencyMs ?? 0),
        });
      } else if (event === "error") {
        input.onEvent({
          type: "error",
          message: String(payload.message ?? "Agent gặp lỗi."),
        });
      }
    } catch {
      // ignore keep-alive
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index = buffer.indexOf("\n\n");
    while (index !== -1) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      handleBlock(block);
      index = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) handleBlock(buffer);
}
