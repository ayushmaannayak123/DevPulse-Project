export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type AgentTurnResult =
  | { type: "final"; sessionId: string; answer: string }
  | { type: "approval_needed"; sessionId: string; toolCalls: ToolCall[] };

export type Role = "user" | "assistant" | "tool" | "system";

export interface DisplayMessage {
  id: string;
  role: Role;
  content: string;
}
