import { ChatWindow } from "./components/ChatWindow";

export default function App() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid #e2e8f0",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16 }}>DevPulse</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Agentic GitHub Intelligence — MCP + ReAct + Human-in-the-Loop
        </div>
      </header>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <ChatWindow />
      </div>
    </div>
  );
}
