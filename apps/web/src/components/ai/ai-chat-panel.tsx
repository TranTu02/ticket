import { Bot, Loader2, Plus, SendHorizontal, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type AiAgentOption,
  type AiConversation,
  type AiMessage,
  createAiConversation,
  fetchAiAgents,
  fetchAiConversations,
  fetchAiMessages,
  streamAiMessage,
} from "@/fetchers/ai/ai-chat";
import { cn } from "@/lib/cn";

interface AiChatPanelProps {
  workspaceId: string;
}

interface DisplayMessage {
  key: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  failed?: boolean;
}

const STORAGE_KEY = "kaneo.ai-chat.conversation";
const SUGGESTIONS = [
  "Hệ thống hiện tại có khỏe không?",
  "Tìm tin mới nhất về AI agent hôm nay.",
  "Mấy giờ rồi ở Bangkok?",
];

export default function AiChatPanel({ workspaceId }: AiChatPanelProps) {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<AiAgentOption[]>([]);
  const [agentId, setAgentId] = useState("coordinator-agent");
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [active, setActive] = useState<AiConversation | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentAgent = agents.find((agent) => agent.id === (active?.agentId ?? agentId));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [nextAgents, nextConversations] = await Promise.all([
          fetchAiAgents(),
          fetchAiConversations(workspaceId),
        ]);
        if (cancelled) return;
        setAgents(nextAgents);
        setConversations(nextConversations);
        if (nextAgents[0] && !nextAgents.some((agent) => agent.id === agentId)) {
          setAgentId(nextAgents[0].id);
        }
        const savedId = localStorage.getItem(`${STORAGE_KEY}.${workspaceId}`);
        const saved = nextConversations.find((item) => item.conversationId === savedId);
        if (saved) setActive(saved);
        else if (nextConversations[0]) setActive(nextConversations[0]);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t("ai:loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  useEffect(() => {
    if (!active) {
      setMessages([]);
      return;
    }
    localStorage.setItem(`${STORAGE_KEY}.${workspaceId}`, active.conversationId);
    let cancelled = false;
    (async () => {
      try {
        const history = await fetchAiMessages(active.conversationId);
        if (cancelled) return;
        setMessages(
          history
            .filter((message: AiMessage) => message.role === "user" || message.role === "assistant")
            .map((message) => ({
              key: message.messageId,
              role: message.role as "user" | "assistant",
              content: message.content,
              failed: message.status === "ERROR",
            })),
        );
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t("ai:loadError"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.conversationId, workspaceId]);

  const startNewChat = useCallback(
    async (nextAgentId = agentId) => {
      setError("");
      try {
        const conversation = await createAiConversation({
          agentId: nextAgentId,
          workspaceId,
          title: t("ai:newChatTitle"),
        });
        setConversations((prev) => [conversation, ...prev]);
        setActive(conversation);
        setMessages([]);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t("ai:createError"));
      }
    },
    [agentId, workspaceId, t],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending) return;
      setError("");
      setInput("");
      setSending(true);

      let conversation = active;
      try {
        if (!conversation) {
          conversation = await createAiConversation({
            agentId,
            workspaceId,
            title: content.slice(0, 60),
          });
          setActive(conversation);
          setConversations((prev) => [conversation as AiConversation, ...prev]);
        }

        const conversationId = conversation.conversationId;
        const userKey = `local-user-${Date.now()}`;
        const agentKey = `local-agent-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          { key: userKey, role: "user", content },
          { key: agentKey, role: "assistant", content: "", pending: true },
        ]);

        const controller = new AbortController();
        abortRef.current = controller;

        await streamAiMessage({
          conversationId,
          content,
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === "delta") {
              setMessages((prev) =>
                prev.map((message) =>
                  message.key === agentKey
                    ? { ...message, content: message.content + event.text }
                    : message,
                ),
              );
            } else if (event.type === "error") {
              setError(event.message);
              setMessages((prev) =>
                prev.map((message) =>
                  message.key === agentKey
                    ? { ...message, pending: false, failed: true }
                    : message,
                ),
              );
            } else if (event.type === "done") {
              setMessages((prev) =>
                prev.map((message) =>
                  message.key === agentKey
                    ? { ...message, pending: false, failed: false, key: event.messageId || message.key }
                    : message,
                ),
              );
            }
          },
        });

        setConversations((prev) =>
          prev.map((item) =>
            item.conversationId === conversationId
              ? { ...item, updatedAt: new Date().toISOString() }
              : item,
          ),
        );
        window.setTimeout(() => {
          fetchAiConversations(workspaceId)
            .then(setConversations)
            .catch(() => undefined);
        }, 800);
      } catch (cause) {
        if ((cause as Error)?.name !== "AbortError") {
          setError(cause instanceof Error ? cause.message : t("ai:sendError"));
        }
        setMessages((prev) =>
          prev.map((message) =>
            message.pending ? { ...message, pending: false, failed: true } : message,
          ),
        );
      } finally {
        abortRef.current = null;
        setSending(false);
      }
    },
    [active, agentId, workspaceId, sending, t],
  );

  const stop = () => {
    abortRef.current?.abort();
  };

  return (
    <div
      className="flex h-full min-h-0"
      data-ai-chat=""
      data-sending={sending ? "true" : "false"}
    >
      <aside className="flex w-62 shrink-0 flex-col border-r bg-muted/20">
        <div className="p-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => void startNewChat()}
          >
            <Plus className="size-4" aria-hidden />
            {t("ai:newChat")}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {conversations.length === 0 ? (
            <p className="px-2 py-4 text-muted-foreground text-xs">{t("ai:noConversations")}</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {conversations.map((conversation) => (
                <li key={conversation.conversationId}>
                  <button
                    type="button"
                    onClick={() => setActive(conversation)}
                    className={cn(
                      "w-full truncate rounded-md px-2 py-2 text-left text-xs transition-colors",
                      active?.conversationId === conversation.conversationId
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    {conversation.title || t("ai:untitled")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
          <Bot className="size-4 text-muted-foreground" aria-hidden />
          <span className="truncate font-medium text-sm">
            {currentAgent?.name ?? t("ai:defaultAgent")}
          </span>
          {active ? null : (
            <Badge variant="outline" className="text-[10px]">
              {t("ai:newChatTitle")}
            </Badge>
          )}
          <div className="ml-auto w-44">
            <Select
              value={agentId}
              onValueChange={(value) => {
                if (typeof value !== "string" || value === agentId) return;
                setAgentId(value);
                void startNewChat(value);
              }}
              disabled={sending}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {error ? (
          <p
            role="alert"
            className="border-b bg-destructive/10 px-3 py-2 text-destructive text-xs"
          >
            {error}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("ai:loading")}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-start gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <Bot className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="font-medium text-sm">{t("ai:emptyTitle")}</h2>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {t("ai:emptyDescription")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <Button
                      key={suggestion}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void send(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.key}
                  data-message-role={message.role}
                  className={cn(
                    "flex flex-col gap-1",
                    message.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {message.role === "user" ? t("ai:you") : (currentAgent?.name ?? t("ai:defaultAgent"))}
                  </span>
                  <div
                    data-message-content={message.role}
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-relaxed",
                      message.role === "user"
                        ? "border bg-muted"
                        : "border border-transparent bg-transparent px-0 py-0",
                      message.failed && "text-destructive",
                    )}
                  >
                    {message.pending && !message.content ? (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        {t("ai:thinking")}
                      </span>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <form
          className="shrink-0 border-t bg-background p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("ai:placeholder")}
              rows={2}
              className="min-h-16 resize-none"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              disabled={sending}
            />
            {sending ? (
              <Button type="button" variant="outline" size="icon" onClick={stop} aria-label={t("ai:stop")}>
                <Square className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!input.trim()} aria-label={t("ai:send")}>
                <SendHorizontal className="size-4" aria-hidden />
              </Button>
            )}
          </div>
          <p className="mx-auto mt-1.5 w-full max-w-3xl text-[11px] text-muted-foreground">
            {t("ai:footerHint")}
          </p>
        </form>
      </section>
    </div>
  );
}
