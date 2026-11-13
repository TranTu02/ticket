// Đọc SSE từ Mastra agent stream. Mastra phát các chunk JSON trong `data:`;
// ticket API chuyển thành event đơn giản (delta/done) để web không phụ thuộc
// định dạng nội bộ của Mastra.

export interface MastraChunkHandlers {
  onDelta: (text: string) => void;
  onTrace?: (traceId: string) => void;
  onError?: (message: string) => void;
}

export function createMastraSseParser(handlers: MastraChunkHandlers) {
  let buffer = "";

  const emitText = (text: unknown) => {
    if (typeof text === "string" && text.length > 0) handlers.onDelta(text);
  };

  const handleChunk = (chunk: Record<string, unknown>) => {
    if (typeof chunk.traceId === "string") handlers.onTrace?.(chunk.traceId);

    const payload = (chunk.payload ?? {}) as Record<string, unknown>;

    switch (chunk.type) {
      case "text-delta":
        emitText(payload.text ?? chunk.text);
        break;
      case "text":
        emitText(chunk.text ?? payload.text);
        break;
      case "error":
        handlers.onError?.(
          typeof payload.error === "string"
            ? payload.error
            : typeof chunk.error === "string"
              ? chunk.error
              : "Agent gặp lỗi khi trả lời.",
        );
        break;
      case "step-finish": {
        // Fallback: một số model trả toàn bộ text trong messages thay vì delta.
        const messages = (payload.messages ?? []) as Array<{
          content?: Array<{ type?: string; text?: string }>;
        }>;
        for (const message of messages) {
          for (const part of message.content ?? []) {
            if (part.type === "text") emitText(part.text);
          }
        }
        break;
      }
      default:
        break;
    }
  };

  const parseBlock = (block: string) => {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const chunk = JSON.parse(raw) as Record<string, unknown>;
        handleChunk(chunk);
      } catch {
        // ignore malformed keep-alive lines
      }
    }
  };

  return {
    push(text: string) {
      buffer += text;
      let index = buffer.indexOf("\n\n");
      while (index !== -1) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        parseBlock(block);
        index = buffer.indexOf("\n\n");
      }
    },
    flush() {
      if (buffer.trim()) {
        parseBlock(buffer);
        buffer = "";
      }
    },
  };
}
