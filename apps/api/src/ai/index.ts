import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { BaseVariables } from "../openapi";
import {
  AGENT_API_URL,
  AI_AGENTS,
  isAiAgentId,
  resolveChatIdentity,
} from "./identity";
import {
  addMessage,
  createConversation,
  finishRun,
  getConversation,
  listConversations,
  listMessages,
  startRun,
  writeAudit,
} from "./store";
import { createMastraSseParser } from "./stream";

// Chat AI của ticket: gọi agent stream bên AI platform (Mastra, cổng 4111)
// rồi lưu hội thoại vào schema service để vận hành/audit.
export const aiRoutes = new Hono<{ Variables: BaseVariables }>();

const currentIdentity = async (c: {
  get: (key: "userId" | "userEmail") => string | undefined;
}) => {
  const userId = c.get("userId");
  const email = c.get("userEmail");
  if (!userId || !email)
    throw new HTTPException(401, { message: "Unauthorized" });
  return resolveChatIdentity(userId, email);
};

aiRoutes.get("/agents", (c) => c.json({ agents: AI_AGENTS }));

aiRoutes.get("/conversations", async (c) => {
  const identity = await currentIdentity(c);
  const workspaceId = c.req.query("workspaceId");
  const conversations = await listConversations(
    identity.identityId,
    workspaceId,
  );
  return c.json({ conversations });
});

aiRoutes.post("/conversations", async (c) => {
  const identity = await currentIdentity(c);
  const body = (await c.req.json().catch(() => null)) as {
    agentId?: string;
    title?: string;
    workspaceId?: string;
    projectId?: string;
  } | null;

  const agentId = body?.agentId?.trim() || "coordinator-agent";
  if (!isAiAgentId(agentId)) {
    throw new HTTPException(400, { message: "Agent không hợp lệ" });
  }

  const conversation = await createConversation({
    identityId: identity.identityId,
    agentId,
    title: body?.title ?? null,
    workspaceId: body?.workspaceId ?? null,
    projectId: body?.projectId ?? null,
  });

  return c.json({ conversation }, 201);
});

aiRoutes.get("/conversations/:conversationId/messages", async (c) => {
  const identity = await currentIdentity(c);
  const conversationId = c.req.param("conversationId");
  const conversation = await getConversation(
    conversationId,
    identity.identityId,
  );
  if (!conversation)
    throw new HTTPException(404, { message: "Không tìm thấy hội thoại" });

  const messages = await listMessages(conversationId);
  return c.json({ conversation, messages });
});

aiRoutes.post("/conversations/:conversationId/messages", async (c) => {
  const identity = await currentIdentity(c);
  const conversationId = c.req.param("conversationId");
  const conversation = await getConversation(
    conversationId,
    identity.identityId,
  );
  if (!conversation)
    throw new HTTPException(404, { message: "Không tìm thấy hội thoại" });

  const body = (await c.req.json().catch(() => null)) as {
    content?: string;
  } | null;
  const content = body?.content?.trim();
  if (!content)
    throw new HTTPException(400, { message: "Nội dung tin nhắn trống" });

  const agentId = conversation.agentId;
  if (!isAiAgentId(agentId)) {
    throw new HTTPException(400, {
      message: "Agent của hội thoại không hợp lệ",
    });
  }

  // Gọi agent trước khi mở stream để lỗi kết nối trả về JSON rõ ràng.
  let upstream: Response;
  try {
    upstream = await fetch(`${AGENT_API_URL}/api/agents/${agentId}/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content }],
        memory: {
          thread: conversation.threadId ?? conversationId,
          resource: identity.identityId,
        },
      }),
    });
  } catch (error) {
    throw new HTTPException(502, {
      message: `Không gọi được AI platform tại ${AGENT_API_URL}: ${
        error instanceof Error ? error.message : "unknown"
      }`,
    });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    throw new HTTPException(502, {
      message: `AI platform trả lỗi ${upstream.status}: ${detail.slice(0, 300)}`,
    });
  }

  await addMessage({
    conversationId,
    role: "user",
    content,
    identityId: identity.identityId,
    agentId,
  });
  const runId = await startRun({
    conversationId,
    agentId,
    identityId: identity.identityId,
  });
  await writeAudit({
    identityId: identity.identityId,
    action: "ai.message.send",
    targetType: "aiConversation",
    targetId: conversationId,
    detail: { agentId, runId },
  });

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      let traceId: string | null = null;
      let agentError: string | null = null;

      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const parser = createMastraSseParser({
        onDelta(text) {
          answer += text;
          send("delta", { text });
        },
        onTrace(id) {
          traceId = id;
        },
        onError(message) {
          agentError = message;
        },
      });

      send("start", { runId, conversationId, agentId });

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
        }
        parser.flush();
      } catch (error) {
        agentError = error instanceof Error ? error.message : "Stream bị ngắt.";
      }

      const latencyMs = Date.now() - startedAt;
      const failed = Boolean(agentError) || answer.length === 0;
      const finalText = answer || agentError || "(Agent không trả về nội dung)";

      try {
        const messageId = await addMessage({
          conversationId,
          role: "assistant",
          content: finalText,
          status: failed ? "ERROR" : "DONE",
          identityId: identity.identityId,
          agentId,
          runId,
          traceId,
          latencyMs,
          errorText: agentError,
        });

        await finishRun({
          runId,
          status: failed ? "FAILED" : "SUCCESS",
          latencyMs,
          traceId,
          outputSummary: finalText,
          errorText: agentError,
        });

        if (failed)
          send("error", { message: agentError ?? "Agent không trả lời." });
        else send("done", { messageId, runId, latencyMs });
      } catch (error) {
        send("error", {
          message: `Không lưu được hội thoại vào schema service: ${
            error instanceof Error ? error.message : "unknown"
          }`,
        });
      }

      controller.close();
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
