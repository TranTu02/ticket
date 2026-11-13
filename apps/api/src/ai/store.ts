import { sql } from "drizzle-orm";
import db from "../database";

export interface ConversationRow {
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

export interface MessageRow {
  messageId: string;
  conversationId: string;
  role: string;
  content: string;
  status: string;
  agentId: string | null;
  runId: string | null;
  createdAt: string;
}

const newId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export async function createConversation(input: {
  identityId: string;
  agentId: string;
  workspaceId?: string | null;
  projectId?: string | null;
  title?: string | null;
}): Promise<ConversationRow> {
  const conversationId = newId("conv");
  // threadId trùng conversationId: Mastra memory lưu theo thread này, nên
  // ticket và AI platform có cùng một mạch hội thoại khi cần đối chiếu.
  const threadId = conversationId;
  const result = await db.execute(
    sql`insert into service."aiConversation"
          ("conversationId", "sourceApp", "identityId", "agentId", title, "workspaceId", "projectId", "threadId")
        values (${conversationId}, 'ticket', ${input.identityId}, ${input.agentId},
                ${input.title ?? null}, ${input.workspaceId ?? null}, ${input.projectId ?? null}, ${threadId})
        returning "conversationId", "agentId", title, status, "threadId", "workspaceId", "projectId",
                  "createdAt", "updatedAt"`,
  );
  return result.rows[0] as unknown as ConversationRow;
}

export async function listConversations(
  identityId: string,
  workspaceId?: string,
): Promise<ConversationRow[]> {
  const result = await db.execute(
    sql`select "conversationId", "agentId", title, status, "threadId", "workspaceId", "projectId",
               "createdAt", "updatedAt"
          from service."aiConversation"
         where "identityId" = ${identityId}
           and (${workspaceId ?? null}::text is null or "workspaceId" = ${workspaceId ?? null})
         order by "updatedAt" desc
         limit 50`,
  );
  return result.rows as unknown as ConversationRow[];
}

export async function getConversation(
  conversationId: string,
  identityId: string,
): Promise<ConversationRow | null> {
  const result = await db.execute(
    sql`select "conversationId", "agentId", title, status, "threadId", "workspaceId", "projectId",
               "createdAt", "updatedAt"
          from service."aiConversation"
         where "conversationId" = ${conversationId} and "identityId" = ${identityId}
         limit 1`,
  );
  return (result.rows[0] as unknown as ConversationRow) ?? null;
}

export async function listMessages(conversationId: string): Promise<MessageRow[]> {
  const result = await db.execute(
    sql`select "messageId", "conversationId", role, content, status, "agentId", "runId", "createdAt"
          from service."aiMessage"
         where "conversationId" = ${conversationId}
         order by "createdAt"`,
  );
  return result.rows as unknown as MessageRow[];
}

export async function addMessage(input: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  status?: "DONE" | "ERROR";
  identityId: string;
  agentId: string;
  runId?: string | null;
  traceId?: string | null;
  latencyMs?: number | null;
  errorText?: string | null;
}): Promise<string> {
  const messageId = newId("msg");
  await db.execute(
    sql`insert into service."aiMessage"
          ("messageId", "conversationId", role, content, status, "agentId", "identityId",
           "runId", "traceId", "latencyMs", "errorText")
        values (${messageId}, ${input.conversationId}, ${input.role}, ${input.content},
                ${input.status ?? "DONE"}, ${input.agentId}, ${input.identityId},
                ${input.runId ?? null}, ${input.traceId ?? null},
                ${input.latencyMs ?? null}, ${input.errorText ?? null})`,
  );
  await db.execute(
    sql`update service."aiConversation" set "updatedAt" = now() where "conversationId" = ${input.conversationId}`,
  );
  return messageId;
}

export async function startRun(input: {
  conversationId: string;
  agentId: string;
  identityId: string;
}): Promise<string> {
  const runId = newId("run");
  await db.execute(
    sql`insert into service."aiRun"
          ("runId", "conversationId", "agentId", "sourceApp", status, "identityId")
        values (${runId}, ${input.conversationId}, ${input.agentId}, 'ticket', 'RUNNING', ${input.identityId})`,
  );
  return runId;
}

export async function finishRun(input: {
  runId: string;
  status: "SUCCESS" | "FAILED";
  latencyMs: number;
  traceId?: string | null;
  outputSummary?: string | null;
  errorText?: string | null;
}): Promise<void> {
  await db.execute(
    sql`update service."aiRun"
           set status = ${input.status},
               "finishedAt" = now(),
               "latencyMs" = ${input.latencyMs},
               "traceId" = ${input.traceId ?? null},
               "outputSummary" = ${input.outputSummary?.slice(0, 500) ?? null},
               "errorText" = ${input.errorText ?? null}
         where "runId" = ${input.runId}`,
  );
}

export async function writeAudit(input: {
  identityId: string;
  action: string;
  targetType: string;
  targetId: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await db.execute(
    sql`insert into service."aiAudit" ("identityId", action, "targetType", "targetId", detail)
        values (${input.identityId}, ${input.action}, ${input.targetType}, ${input.targetId},
                ${JSON.stringify(input.detail ?? {})}::jsonb)`,
  );
}
