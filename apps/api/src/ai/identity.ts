import { sql } from "drizzle-orm";
import db from "../database";

// Các agent được phép gọi từ ticket. Khớp với AI platform (src/mastra/agents).
export const AI_AGENTS = [
  {
    id: "coordinator-agent",
    name: "Điều phối viên",
    description:
      "Nhận yêu cầu, giao việc cho agent chuyên môn rồi tổng hợp kết quả.",
  },
  {
    id: "research-agent",
    name: "Nghiên cứu",
    description: "Tra cứu web, trả về tóm tắt có nguồn.",
  },
  {
    id: "ops-agent",
    name: "Vận hành",
    description: "Kiểm tra sức khỏe hệ thống và giờ hiện tại.",
  },
  {
    id: "self-check-agent",
    name: "Tự kiểm tra",
    description: "Chạy tự kiểm tra, báo PASS/WARN/FAIL.",
  },
] as const;

export type AiAgentId = (typeof AI_AGENTS)[number]["id"];

export const isAiAgentId = (value: string): value is AiAgentId =>
  AI_AGENTS.some((agent) => agent.id === value);

export const AGENT_API_URL = (
  process.env.AGENT_API_URL || "http://localhost:4111"
).replace(/\/+$/, "");

export interface ChatIdentity {
  identityId: string;
  email: string;
  displayName: string | null;
}

/**
 * Map user đang đăng nhập (Kaneo auth) sang identity LIMS trong service schema.
 * Nếu email chưa có trong identity.identities thì tạo identityId nội bộ để
 * vẫn có thể vận hành/audit.
 */
export async function resolveChatIdentity(
  userId: string,
  email: string,
): Promise<ChatIdentity> {
  const found = await db.execute(
    sql`select i."identityId", i.email, i."identityName" as "displayName"
          from identity."identities" i
         where lower(i.email) = lower(${email}) and i."deletedAt" is null
         limit 1`,
  );

  const row = found.rows[0] as
    | { identityId: string; email: string; displayName: string | null }
    | undefined;

  const identity: ChatIdentity = row ?? {
    identityId: `ticket-${userId}`,
    email,
    displayName: email,
  };

  await db.execute(
    sql`insert into service."appUser" ("identityId", "ticketUserId", email, "displayName")
        values (${identity.identityId}, ${userId}, ${identity.email}, ${identity.displayName})
        on conflict ("identityId") do update
          set "ticketUserId" = excluded."ticketUserId", email = excluded.email,
              "updatedAt" = now()`,
  );

  return identity;
}
