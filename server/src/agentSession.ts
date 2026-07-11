/**
 * =============================================================
 * DevPulse Node backend -- Agent session + ReAct loop
 *
 * Same reasoning loop as agent_core.py's DevPulseAgent.ask(), but
 * redesigned for HTTP: agent_core.py blocks on input() to get human
 * approval; a web server can't block a request thread waiting on a
 * browser click. Instead, the loop here PAUSES and returns control to
 * the caller whenever a tool call needs approval -- the actual approve/
 * deny decision arrives later as a separate POST /api/approve request,
 * which resumes the loop from where it left off.
 * =============================================================
 */

import { randomUUID } from "node:crypto";
import type OpenAI from "openai";
import { getMcpClient, discoverOpenAITools, callMcpTool, type OpenAIToolDef } from "./mcpClient.js";
import { getLlmClient } from "./llmClient.js";

const SYSTEM_PROMPT =
  "You are DevPulse, an assistant that answers questions about GitHub " +
  "repositories using real, live tools. Always use a tool to look up facts " +
  "instead of guessing. Remember repo names mentioned earlier in the " +
  "conversation so the user doesn't have to repeat them.";

const MAX_LOOPS = 4;

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export interface PendingToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface Session {
  id: string;
  history: ChatMessage[];
  pending: PendingToolCall[] | null;
  loopCount: number;
}

export type AgentTurnResult =
  | { type: "final"; sessionId: string; answer: string }
  | { type: "approval_needed"; sessionId: string; toolCalls: PendingToolCall[] };

const sessions = new Map<string, Session>();

export function createSession(): Session {
  const session: Session = { id: randomUUID(), history: [], pending: null, loopCount: 0 };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

/** Call the LLM once with the current history + tools, and either return a
 * final answer or a set of tool calls awaiting human approval. */
async function step(session: Session, tools: OpenAIToolDef[]): Promise<AgentTurnResult> {
  const { client, model } = getLlmClient();

  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }, ...session.history];

  const response = await client.chat.completions.create({
    model,
    messages,
    tools,
    tool_choice: "auto",
  });

  const choice = response.choices[0];
  const msg = choice.message;

  if (choice.finish_reason !== "tool_calls" || !msg.tool_calls?.length) {
    session.history.push({ role: "assistant", content: msg.content ?? "" });
    return { type: "final", sessionId: session.id, answer: msg.content ?? "" };
  }

  session.history.push({
    role: "assistant",
    content: msg.content,
    tool_calls: msg.tool_calls,
  });

  const pending: PendingToolCall[] = msg.tool_calls.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments || "{}"),
  }));

  session.pending = pending;
  return { type: "approval_needed", sessionId: session.id, toolCalls: pending };
}

/** Entry point for a new user message -- starts (or continues) the loop. */
export async function sendMessage(session: Session, userInput: string): Promise<AgentTurnResult> {
  session.history.push({ role: "user", content: userInput });
  session.loopCount = 0;

  const mcpClient = await getMcpClient();
  const tools = await discoverOpenAITools(mcpClient);

  return step(session, tools);
}

/** Resolve a pending set of tool calls with approve/deny decisions, execute
 * whatever was approved, feed results back, and continue the loop -- may
 * itself return another approval_needed if the LLM asks for more tools. */
export async function resolveApproval(
  session: Session,
  decisions: Record<string, boolean>
): Promise<AgentTurnResult> {
  if (!session.pending) {
    throw new Error("No pending tool calls for this session.");
  }

  const mcpClient = await getMcpClient();

  for (const call of session.pending) {
    const approved = decisions[call.id] ?? false;
    let resultText: string;

    if (!approved) {
      resultText = "Tool execution denied by human reviewer.";
    } else {
      resultText = await callMcpTool(mcpClient, call.name, call.arguments);
    }

    session.history.push({
      role: "tool",
      tool_call_id: call.id,
      content: resultText,
    });
  }

  session.pending = null;
  session.loopCount += 1;

  if (session.loopCount >= MAX_LOOPS) {
    const answer = "I wasn't able to resolve this within the allotted reasoning steps.";
    session.history.push({ role: "assistant", content: answer });
    return { type: "final", sessionId: session.id, answer };
  }

  const tools = await discoverOpenAITools(mcpClient);
  return step(session, tools);
}
