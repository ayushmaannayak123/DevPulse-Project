import type { DisplayMessage } from "../types";

export function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        margin: "8px 0",
      }}
    >
      <div
        style={{
          maxWidth: "75%",
          padding: "10px 14px",
          borderRadius: 12,
          background: isUser ? "#2563eb" : isTool ? "#f1f5f9" : "#e2e8f0",
          color: isUser ? "#fff" : "#0f172a",
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          fontFamily: isTool ? "ui-monospace, monospace" : "inherit",
        }}
      >
        {isTool && (
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>TOOL RESULT</div>
        )}
        {message.content}
      </div>
    </div>
  );
}
