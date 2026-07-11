import { useState, useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
import { ApprovalCard } from "./ApprovalCard";
import { sendChatMessage, sendApproval } from "../api";
import type { DisplayMessage, ToolCall } from "../types";

export function ChatWindow() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCall[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingToolCalls]);

  const addMessage = (role: DisplayMessage["role"], content: string) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, content }]);
  };

  const handleSend = async () => {
    if (!input.trim() || busy) return;
    const userText = input.trim();
    setInput("");
    setError(null);
    addMessage("user", userText);
    setBusy(true);

    try {
      const result = await sendChatMessage(userText, sessionId);
      setSessionId(result.sessionId);

      if (result.type === "final") {
        addMessage("assistant", result.answer);
      } else {
        setPendingToolCalls(result.toolCalls);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDecide = async (decisions: Record<string, boolean>) => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);

    const deniedNote = Object.entries(decisions)
      .filter(([, approved]) => !approved)
      .map(([id]) => id);
    if (deniedNote.length) {
      addMessage("tool", "Tool execution denied by human reviewer.");
    }

    setPendingToolCalls(null);

    try {
      const result = await sendApproval(sessionId, decisions);
      if (result.type === "final") {
        addMessage("assistant", result.answer);
      } else {
        setPendingToolCalls(result.toolCalls);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxWidth: 720,
        margin: "0 auto",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 8px" }}>
        {messages.length === 0 && (
          <div style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", marginTop: 40 }}>
            Ask about a GitHub repo, e.g. "Tell me about facebook/react"
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {pendingToolCalls && (
          <ApprovalCard toolCalls={pendingToolCalls} onDecide={handleDecide} disabled={busy} />
        )}
        {error && (
          <div style={{ color: "#dc2626", fontSize: 13, margin: "8px 0" }}>Error: {error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "12px 8px", borderTop: "1px solid #e2e8f0" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={busy || !!pendingToolCalls}
          placeholder="Ask DevPulse about a GitHub repo..."
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 14,
          }}
        />
        <button
          onClick={handleSend}
          disabled={busy || !!pendingToolCalls || !input.trim()}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
