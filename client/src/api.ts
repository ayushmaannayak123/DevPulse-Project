import type { AgentTurnResult } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function sendChatMessage(
  message: string,
  sessionId?: string
): Promise<AgentTurnResult> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function sendApproval(
  sessionId: string,
  decisions: Record<string, boolean>
): Promise<AgentTurnResult> {
  const res = await fetch(`${API_URL}/api/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, decisions }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}
